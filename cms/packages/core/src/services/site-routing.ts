/**
 * Site routing — what a build publishes, and where the rest of the deployment
 * lives.
 *
 * Contract (also documented in migration 043 and 051)
 * -------------------------------------------
 * A site's `content_routes` column is a JSON object mapping collection name to
 * the path prefix that collection is published under **on that site**
 * (`''` = that host's root), and `content_mode` says which of the two things the
 * site is:
 *
 *   * `paths` — the site **publishes the website**: its own routes and every
 *     routed collection at the collection's own `url_prefix`, with `content_routes`
 *     overriding the prefix of the collections it names (`/blog`, `/docs`, ...).
 *     A site with no content routes is a `paths` site, which is what every site did
 *     before migration 051.
 *   * `standalone` — a **content-only site**: it publishes only the listed
 *     collections, at the listed prefixes. `publishes_app` (migration 055) adds the
 *     website's own routes to that — the collection routed at `''` still owns the
 *     root, and the app's pages sit beside it (`/docs`, `/demos`, ...).
 *
 * That is enough for one repository to build two hosts: `GET /api/site`
 * (routes/api.ts) answers with this site's own routes, the absolute base URL of
 * every collection the *other* active sites publish (`external`, so the main site
 * can link to the blog host and back), and the base URL of the site that builds
 * the website itself (`appBaseUrl`, for a content-only site's links home).
 *
 * `external` is "collections published by a different active site" regardless of
 * who is asking: a collection can only be local to a site when no other active
 * site claims it in its `content_routes`. So a `paths` site also receives
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

import type { Site, SiteContentMode } from './sites'
import { SitesService, parseSiteContentRoutes } from './sites'
import { resolveContentSiteScope } from './content-site-scope'
import type { ContentSiteScope, ResolveSiteScopeInput } from './content-site-scope'

/**
 * How a site publishes (see {@link SiteContentMode}), with rows that predate the
 * column classified from what they already do: every site that existed was deployed
 * on its own, so an unset mode is `standalone`. `paths` (migration 052) means the
 * site is *not* deployed — its content is published by {@link Site.parentSiteId}.
 */
export const siteContentMode = (site: Site): SiteContentMode =>
  site.contentMode === 'paths' ? 'paths' : 'standalone'

/** True when the site is deployed on its own and therefore built. */
export const isDeployed = (site: Site): boolean => siteContentMode(site) === 'standalone'

/**
 * True when a site builds the website's own routes: it is deployed and declares no
 * content routes, so it publishes the app plus every collection the CMS routes.
 */
export const publishesWebsite = (site: Site): boolean =>
  isDeployed(site) && parseSiteContentRoutes(site.contentRoutes) === null

/**
 * True when this site's build publishes the website's own routes (the front page,
 * `/demos`, the framework documentation, ...).
 *
 * That is the classic app site — deployed, no content routes — and, since migration
 * 055, also a content host that asked for them beside the collections it names
 * (`publishes_app`). A `paths` site is never one: it is not built at all.
 */
export const publishesAppRoutes = (site: Site): boolean =>
  isDeployed(site) && (parseSiteContentRoutes(site.contentRoutes) === null || site.publishesApp)

/** How one site is wired: what it publishes and where everything else lives. */
export interface SiteRouting {
  slug: string
  name: string
  /** The site's primary custom domain hostname, when it has one. */
  domain: string | null
  /** The mode this site publishes in; see {@link siteContentMode}. */
  contentMode: SiteContentMode
  /** The site this one is mounted on, when it publishes in `paths` mode. */
  parentSiteId: string | null
  /** The parent's slug, so a build can report where a mounted site is published. */
  parentSlug: string | null
  /**
   * Collection name -> prefix on this site.
   *
   * On a deployed site that declares no routes it is `null` (it publishes the website
   * and every collection at the collection's own `url_prefix`); otherwise it is the
   * set of collections the host serves, at the prefixes given — a collection missing
   * from it keeps its own `url_prefix`.
   */
  contentRoutes: Record<string, string> | null
  /**
   * Whether this build publishes the website's own routes (migration 055) — true for
   * the site that builds the website itself, and for a content host that asked for
   * them beside its collections. Such a build generates them *and* keeps the root of
   * a collection it routed at `''`, which is what puts a documentation or blog index
   * on the front page of its own subdomain.
   */
  publishesApp: boolean
  /**
   * What the sites mounted on this one publish, as collection -> prefix (migration
   * 052). The build merges these into its own prefixes, so a `paths` site's content
   * appears on this host at the path its parent declares.
   */
  mounts: Record<string, string>
  /**
   * Absolute base URL of a collection published on another active site, by
   * collection name. A collection listed here is *not* published locally — even
   * on a site that publishes the website — so the build must skip it and link to
   * this URL instead.
   */
  external: Record<string, string>
  /**
   * Base URL this build's links home point at: the parent site for a `paths` site,
   * the site that builds the website for a content-only host, null for that site
   * itself.
   */
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
  const contentMode = siteContentMode(site)
  // The sites mounted on this one (migration 052): a `paths` site is published by its
  // parent, at the prefixes its own content routes name — a collection it does not
  // name keeps that collection own `url_prefix`. This is what the parent build has to
  // add to what it already publishes.
  const children = contentMode === 'standalone' ? await service.listChildren(site.id) : []
  const mounts: Record<string, string> = {}
  for (const child of children) {
    for (const [collection, prefix] of Object.entries(
      parseSiteContentRoutes(child.contentRoutes) ?? {}
    )) {
      if (mounts[collection] === undefined) mounts[collection] = prefix
    }
  }

  // Collections that are local to this site: its own explicit routes plus everything
  // the sites mounted on it publish. A collection claimed by another site elsewhere is
  // not built here at all — it is linked to through `external` — so `published` is
  
  // deliberately only what this site (or the sites mounted on it) publishes, never
  // "everything" for a site that publishes the website.
  const published = new Set([...Object.keys(contentRoutes ?? {}), ...Object.keys(mounts)])

  // `external` = every collection published by a *different* deployed site, resolved
  // to an absolute URL on that host, so this build skips generating a collection that
  // has moved to its own host and links there instead. This site own collections — and
  // those of the sites mounted on it — are skipped so a link never points at itself, and
  // the first other site to claim a collection wins (a second one would be a
  // configuration error, not something to silently override). A `paths` site is not a
  // host of its own, so it is never offered as an external target either.
  const external: Record<string, string> = {}
  for (const other of sites) {
    if (other.id === site.id || !isDeployed(other)) continue
    const base = baseUrlOf(other)
    if (!base) continue
    for (const [collection, prefix] of Object.entries(
      parseSiteContentRoutes(other.contentRoutes) ?? {}
    )) {
      if (published.has(collection) || external[collection]) continue
      external[collection] = joinBaseUrl(base, prefix)
    }
  }

  // The active site that builds the website itself is a deployed site with no content
  // routes. A content-only host links its shell navigation back to it; the website site
  // itself (and a deployment with no such site) resolves to null.
  //
  // A deployment can have several sites that publish the website — the same website
  // deployed as a Worker and to Pages, for instance — and a Worker without a custom
  // domain has no host to link to. The first candidate with a resolvable base URL wins,
  // so a secondary host is not left pointing at nothing.
  const appSite = sites.find(
    (candidate) =>
      candidate.id !== site.id && publishesWebsite(candidate) && baseUrlOf(candidate) !== null
  )

  // A mounted site is published by its parent, and its own links point there: the parent
  // is the host that serves the website its content lives on.
  const parent =
    contentMode === 'paths' && site.parentSiteId
      ? sites.find((candidate) => candidate.id === site.parentSiteId) ?? null
      : null
  const homeBase = parent ? baseUrlOf(parent) : appSite ? baseUrlOf(appSite) : null

  // The app's own routes are only "elsewhere" for a site that does not publish them:
  // a content host that asked for them (migration 055) serves them itself, so its
  // links to /demos and the like stay on this host.
  const publishesApp = publishesAppRoutes(site)

  return {
    slug: site.slug,
    name: site.name,
    domain: domains.get(site.id) ?? null,
    contentMode,
    parentSiteId: site.parentSiteId ?? null,
    parentSlug: parent?.slug ?? null,
    contentRoutes,
    publishesApp,
    mounts,
    external,
    appBaseUrl: publishesApp ? null : homeBase
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
