/**
 * Content site scoping — how a request declares which site it is, and what
 * subset of content it may therefore read.
 *
 * Rule (enforced server-side, never widen-able by the caller):
 *   * a request that identifies an active site sees **the content assigned to that
 *     site and to the `paths` sites mounted on it** (migration 052/053). The
 *     assignment *is* the publication control: an item assigned to no site is
 *     returned to nobody, and "every site" is expressed by assigning every site.
 *   * a request that identifies nothing sees **nothing**, once at least one site is
 *     registered — a multi-tenant deployment must not leak every site's content
 *     just because a client omitted a header
 *   * a single-tenant deployment (no sites registered at all) keeps the old
 *     behaviour and sees everything, so existing setups are unaffected
 *
 * A site identifies itself with `X-Site: <slug|id>` or `?site=<slug|id>`.
 * Content ownership is `content_sites` (migration 052/053) — every site that
 * publishes the item — and `content.site_id` (migration 038) stays as the
 * primary/owning site that the admin list and the revisions already read.
 *
 * A request authenticated with a **site-pinned API token** (migration 040) gets
 * that site regardless of what it sends: a build token issued for one site must
 * not be able to read another site's content by changing the header.
 */

import type { QueryFilter } from '../utils/query-filter'

/** How the request identified its site. */
export type SiteScopeSource = 'header' | 'query' | 'token' | 'none'

/** What the resolved scope allows. */
export type SiteScopeMode =
  /** No sites registered — single-tenant, everything is readable. */
  | 'all'
  /** Identified site + shared content. */
  | 'site+shared'
  /** Only shared content (no site identified on a multi-tenant deployment). */
  | 'shared-only'

export interface ContentSiteScope {
  /** Resolved site id, when a site was identified. */
  siteId: string | null
  /**
   * Every site whose content this request may read: the identified site plus the
   * `paths` sites mounted on it (their content is published by this one, so a build
   * of the parent has to see it). Empty for a scope that identified no site.
   */
  relatedSiteIds: string[]
  /** Resolved site slug, when a site was identified. */
  siteSlug: string | null
  /** Raw value the caller sent, if any (used to report unknown sites). */
  requested: string | null
  source: SiteScopeSource
  mode: SiteScopeMode
  /** True when a site was requested but does not exist / is inactive. */
  unknown: boolean
  /** Human readable explanation, surfaced in response meta for diagnosability. */
  reason: string
}

export interface ResolveSiteScopeInput {
  /** Value of the `X-Site` header. */
  header?: string | null
  /** Value of the `site` query parameter. */
  query?: string | null
  /** Site id a site-pinned API token is bound to; outranks header and query. */
  tokenSiteId?: string | null
}

const clean = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** True when the deployment has at least one active site. */
export async function hasActiveSites(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM sites WHERE is_active = 1 LIMIT 1')
    .first()
  return !!row
}

/**
 * Every site whose content a request scoped to `siteId` may read: the site itself
 * plus the `paths` sites mounted on it (migration 052). Those sites are not deployed;
 * their content is published by this one, so its build has to see it.
 */
export async function relatedSiteIdsOf(db: D1Database, siteId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT id FROM sites WHERE parent_site_id = ? AND is_active = 1')
    .bind(siteId)
    .all()

  const related = [siteId]
  for (const row of results ?? []) {
    const id = String((row as { id: unknown }).id)
    if (!related.includes(id)) related.push(id)
  }
  return related
}

/**
 * Resolve the requesting site's content scope.
 *
 * The header wins over the query parameter so a build can pin the header while
 * still allowing ad-hoc `?site=` exploration.
 */
export async function resolveContentSiteScope(
  db: D1Database,
  input: ResolveSiteScopeInput = {}
): Promise<ContentSiteScope> {
  const header = clean(input.header)
  const query = clean(input.query)
  const requested = header ?? query
  const source: SiteScopeSource = header ? 'header' : query ? 'query' : 'none'

  // A site-pinned token outranks the caller: it is how a CI build proves which
  // site it is, without trusting anything the build (or a leaked token used from
  // elsewhere) puts in a header.
  const tokenSiteId = clean(input.tokenSiteId)
  if (tokenSiteId) {
    const pinned = await db
      .prepare('SELECT id, slug FROM sites WHERE id = ? LIMIT 1')
      .bind(tokenSiteId)
      .first()

    if (pinned) {
      const row = pinned as { id: string; slug: string }
      const ignored = requested !== null && requested !== row.slug && requested !== row.id
      return {
        siteId: row.id,
        relatedSiteIds: await relatedSiteIdsOf(db, row.id),
        siteSlug: row.slug,
        requested,
        source: 'token',
        mode: 'site+shared',
        unknown: false,
        reason: ignored
          ? `Pinned to site "${row.slug}" by the API token; the requested site "${requested}" was ignored`
          : `Pinned to site "${row.slug}" by the API token`
      }
    }

    return {
      siteId: null,
      relatedSiteIds: [],
      siteSlug: null,
      requested,
      source: 'token',
      mode: 'shared-only',
      unknown: false,
      reason:
        'The API token is pinned to a site that no longer exists; only shared content is visible'
    }
  }

  if (requested) {
    // Match on slug (the human-facing identifier) or id, active sites only.
    const site = await db
      .prepare('SELECT id, slug FROM sites WHERE is_active = 1 AND (slug = ? OR id = ?) LIMIT 1')
      .bind(requested, requested)
      .first()

    if (site) {
      const row = site as { id: string; slug: string }
      return {
        siteId: row.id,
        relatedSiteIds: await relatedSiteIdsOf(db, row.id),
        siteSlug: row.slug,
        requested,
        source,
        mode: 'site+shared',
        unknown: false,
        reason: `Scoped to site "${row.slug}" (plus shared content)`
      }
    }

    return {
      siteId: null,
      relatedSiteIds: [],
      siteSlug: null,
      requested,
      source,
      mode: 'shared-only',
      unknown: true,
      reason: `Site "${requested}" is not registered (or is inactive); only shared content is visible`
    }
  }

  if (await hasActiveSites(db)) {
    return {
      siteId: null,
      relatedSiteIds: [],
      siteSlug: null,
      requested: null,
      source: 'none',
      mode: 'shared-only',
      unknown: false,
      reason:
        'No site identified (send X-Site or ?site=); only shared content is visible because this deployment has registered sites'
    }
  }

  return {
    siteId: null,
    relatedSiteIds: [],
    siteSlug: null,
    requested: null,
    source: 'none',
    mode: 'all',
    unknown: false,
    reason: 'No sites registered; all content is visible (single-tenant deployment)'
  }
}

/**
 * SQL fragment + params enforcing a scope, or `null` when the scope is `all`.
 *
 * Always server-generated; the site id comes from a DB lookup, never straight
 * from the request.
 */
export function contentSiteScopeFragment(
  scope: ContentSiteScope
): { sql: string; params: any[] } | null {
  if (scope.mode === 'all') return null

  const ids =
    scope.relatedSiteIds && scope.relatedSiteIds.length > 0
      ? scope.relatedSiteIds
      : scope.siteId
        ? [scope.siteId]
        : []

  // No site identified (or a scope that resolved to none) reads nothing: content is
  // published to the sites it is assigned to, and to no others.
  if (ids.length === 0) return { sql: '1 = 0', params: [] }

  // The site itself, the sites mounted on it, and every item assigned to any of them.
  const placeholders = ids.map(() => '?').join(', ')
  return {
    sql:
      `site_id IN (${placeholders}) OR id IN ` +
      `(SELECT content_id FROM content_sites WHERE site_id IN (${placeholders}))`,
    params: [...ids, ...ids]
  }
}

/**
 * Apply a scope to a query filter as a server-controlled condition.
 *
 * Using `internalAnd` (rather than mutating `where`) keeps the scope out of
 * client reach, and because it becomes part of the filter object it also
 * changes the API cache key — so one site can never be served another site's
 * cached response.
 *
 * Returns the same filter for convenience.
 */
export function applyContentSiteScope(filter: QueryFilter, scope: ContentSiteScope): QueryFilter {
  const fragment = contentSiteScopeFragment(scope)
  if (!fragment) return filter

  filter.internalAnd = [...(filter.internalAnd ?? []), fragment]
  return filter
}

/** Public, client-safe description of the scope, for response meta. */
export function describeSiteScope(scope: ContentSiteScope): {
  mode: SiteScopeMode
  siteSlug: string | null
  identifiedBy: SiteScopeSource
  reason: string
} {
  return {
    mode: scope.mode,
    siteSlug: scope.siteSlug,
    identifiedBy: scope.source,
    reason: scope.reason
  }
}

export interface ResolvedSiteId {
  /** Resolved site id, or null when no site was named / nothing matched. */
  siteId: string | null
  /** True when a site was named but does not exist. */
  unknown: boolean
  /** The value the caller supplied, if any. */
  requested: string | null
}

/**
 * Resolve a caller-supplied site reference (slug or id) to a site id.
 *
 * Used for *writing* content ownership — the counterpart to
 * {@link resolveContentSiteScope}. Shares the slug-or-id rule so a value that
 * scopes a read also scopes a write.
 */
export async function resolveSiteId(
  db: D1Database,
  value: unknown
): Promise<ResolvedSiteId> {
  const requested = typeof value === 'string' ? value.trim() : ''
  if (requested === '') {
    return { siteId: null, unknown: false, requested: null }
  }

  const row = await db
    .prepare('SELECT id FROM sites WHERE slug = ? OR id = ? LIMIT 1')
    .bind(requested, requested)
    .first()

  if (!row) {
    return { siteId: null, unknown: true, requested }
  }

  return { siteId: String((row as { id: string }).id), unknown: false, requested }
}
