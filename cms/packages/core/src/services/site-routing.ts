/**
 * Site routing — what a build publishes, and where the rest of the deployment
 * lives.
 *
 * Contract (also documented in migration 043)
 * -------------------------------------------
 * A site's `content_routes` column is a JSON object mapping collection name to
 * the path prefix that collection is published under **on that site**
 * (`''` = that host's root):
 *
 *   * `NULL` — an **app site**: it publishes the website's own routes plus every
 *     routed collection at the collection's own `url_prefix`. This is what every
 *     site did before migration 043.
 *   * set — a **content-only site**: it publishes only the listed collections, at
 *     the listed prefixes, and no website routes.
 *
 * That is enough for one repository to build two hosts: `GET /api/site`
 * (routes/api.ts) answers with this site's own routes, the absolute base URL of
 * every collection the *other* active sites publish (`external`, so the main site
 * can link to the blog host and back), and the base URL of the site that builds
 * the website itself (`appBaseUrl`, for a content-only site's links home).
 *
 * `external` is "collections published by a different active site" regardless of
 * who is asking: a collection can only be local to a site when no other active
 * site claims it in its `content_routes`. So an **app site** also receives
 * `external` entries for collections another site has taken over — it must skip
 * generating those and link to the other host instead, exactly as a content-only
 * site does for collections it does not publish.
 *
 * How a site's own base URL is resolved: its first active custom domain
 * (`site_domains`, primary first), else `https://<cf_project_name>.pages.dev` for
 * a `cloudflare-pages` site. A Worker without a custom domain has no derivable
 * hostname (its `workers.dev` subdomain is not stored here), so it resolves to
 * null and is skipped rather than linked to at a wrong address.
 *
 * The Astro loader client mirrors this for D1 builds
 * (`cms/packages/astro/src/d1-client.ts` → `fetchSiteRouting`): a build that reads
 * D1 directly instead of calling the API must route content identically, so the
 * two implementations are kept in step deliberately.
 */

import type { Site } from './sites'
import { SitesService, parseSiteContentRoutes } from './sites'
import { resolveContentSiteScope } from './content-site-scope'
import type { ContentSiteScope, ResolveSiteScopeInput } from './content-site-scope'

/** How one site is wired: what it publishes and where everything else lives. */
export interface SiteRouting {
  slug: string
  name: string
  /** The site's primary custom domain hostname, when it has one. */
  domain: string | null
  /** Collection name -> prefix on this site; null means "app site". */
  contentRoutes: Record<string, string> | null
  /**
   * Absolute base URL of a collection published on another active site, by
   * collection name. A collection listed here is *not* published locally — even
   * on an app site — so the build must skip it and link to this URL instead.
   */
  external: Record<string, string>
  /** Base URL of the site that builds the website, for a content-only site's links home. */
  appBaseUrl: string | null
}

/** The resolved routing of the site a request identified. */
export interface RequestSiteRouting {
  scope: ContentSiteScope
  /** The resolved site row, or null when none was identified/usable. */
  site: Site | null
  /** Null when no usable site was identified — see {@link RequestSiteRouting.reason}. */
  routing: SiteRouting | null
  /** Why `routing` is null, or a short note about the resolution. */
  reason: string
}

/** First active domain per site, primary first — the shape the mirror reads too. */
type DomainLookup = Map<string, string>

const loadActiveDomains = async (db: D1Database): Promise<DomainLookup> => {
  const { results } = await db
    .prepare(
      `SELECT site_id, hostname
         FROM site_domains
        WHERE status = 'active'
        ORDER BY is_primary DESC`
    )
    .all()

  const bySite: DomainLookup = new Map()
  for (const row of results ?? []) {
    const entry = row as { site_id: unknown; hostname: unknown }
    const siteId = String(entry.site_id ?? '')
    const hostname = String(entry.hostname ?? '')
    // `is_primary DESC` puts the canonical hostname first, so the first row per
    // site wins and no separate primary lookup is needed.
    if (siteId === '' || hostname === '' || bySite.has(siteId)) continue
    bySite.set(siteId, hostname)
  }
  return bySite
}

/**
 * Absolute base URL a site is reachable at, without a trailing slash.
 *
 * Exported because the deploy tooling needs the same answer when it advertises a
 * site's URL; `null` means "no resolvable host", never a guessed one.
 */
export const siteBaseUrl = (site: Site, hostname: string | null): string | null => {
  if (hostname) return `https://${hostname}`
  if (site.provider === 'cloudflare-pages' && site.cfProjectName) {
    return `https://${site.cfProjectName}.pages.dev`
  }
  return null
}

/** Join a collection's prefix onto a site's base URL (`''` contributes nothing). */
const joinBaseUrl = (base: string, prefix: string): string =>
  `${base}${prefix.replace(/\/+$/, '')}`

/**
 * Resolve how a given site is wired.
 *
 * `site` is the already-resolved site row (the caller identifies the site through
 * `resolveContentSiteScope`, so this never has to guess), which also keeps the
 * contract readable: routing is a pure function of the registry.
 */
export async function buildSiteRouting(db: D1Database, site: Site): Promise<SiteRouting> {
  const service = new SitesService(db)
  const [sites, domains] = await Promise.all([service.listActive(), loadActiveDomains(db)])

  const baseUrlOf = (candidate: Site): string | null =>
    siteBaseUrl(candidate, domains.get(candidate.id) ?? null)

  const contentRoutes = parseSiteContentRoutes(site.contentRoutes)
  // Collections that are local to this site. An app site nominally publishes
  // every collection at the collection's own `url_prefix`, but that is exactly
  // the case the rule inverts: a collection claimed by another active site is not
  // built here at all — it is linked to through `external` — so `published` is
  // deliberately only this site's *explicit* content routes, never "everything"
  // for an app site. A collection can only be local when no other site claims it.
  const published = new Set(Object.keys(contentRoutes ?? {}))

  // `external` = every collection published by a *different* active site,
  // resolved to an absolute URL on that host. This holds for a content-only site
  // and for an app site alike, so the website skips generating a collection that
  // has moved to its own host and links there instead. The same site's own
  // collections are skipped so a link never points at itself, and the first other
  // site to claim a collection wins (a second one would be a configuration error,
  // not something to silently override).
  const external: Record<string, string> = {}
  for (const other of sites) {
    if (other.id === site.id) continue
    const base = baseUrlOf(other)
    if (!base) continue
    for (const [collection, prefix] of Object.entries(
      parseSiteContentRoutes(other.contentRoutes) ?? {}
    )) {
      if (published.has(collection) || external[collection]) continue
      external[collection] = joinBaseUrl(base, prefix)
    }
  }

  // The active site that builds the website itself is the one with no content
  // routes. A content-only site links its shell's navigation back to it; the app
  // site (and a deployment with no app site) resolves to null.
  const appSite = sites.find(
    (candidate) => candidate.id !== site.id && parseSiteContentRoutes(candidate.contentRoutes) === null
  )

  return {
    slug: site.slug,
    name: site.name,
    domain: domains.get(site.id) ?? null,
    contentRoutes,
    external,
    appBaseUrl: contentRoutes === null || !appSite ? null : baseUrlOf(appSite)
  }
}

/**
 * Identify the site a request names (`X-Site` / `?site=` / a site-pinned API
 * token) and resolve its routing.
 *
 * Shares `resolveContentSiteScope`'s identification rules so a request that reads
 * content is scoped to exactly the site this endpoint describes. A site that was
 * named but is inactive (or whose token pin points at a site that no longer
 * exists) resolves to no routing, with the reason kept for the response meta —
 * the endpoint answers 200 either way so a build can fall back cleanly.
 */
export async function resolveRequestSiteRouting(
  db: D1Database,
  input: ResolveSiteScopeInput = {}
): Promise<RequestSiteRouting> {
  const scope = await resolveContentSiteScope(db, input)
  if (!scope.siteId) {
    return { scope, site: null, routing: null, reason: scope.reason }
  }

  const site = await new SitesService(db).get(scope.siteId)
  if (!site) {
    return {
      scope,
      site: null,
      routing: null,
      reason: `Site "${scope.siteSlug ?? scope.requested ?? scope.siteId}" is not registered; only shared content is visible`
    }
  }

  if (!site.isActive) {
    return {
      scope,
      site: null,
      routing: null,
      reason: `Site "${site.slug}" is inactive; enable it in Admin → Sites to publish it`
    }
  }

  return {
    scope,
    site,
    routing: await buildSiteRouting(db, site),
    reason: `Resolved routing for site "${site.slug}"`
  }
}
