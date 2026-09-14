/**
 * Build-time D1 reader for Sci-Fi CMS.
 *
 * Reads content straight out of the deployment's D1 database through the
 * Cloudflare API, so a build can treat the database as its source of truth and
 * does not depend on the CMS Worker being reachable (nor on its response cache).
 *
 * It mirrors what the public content API returns — the same row shape, the same
 * site scoping, and the same "unknown site" being an error rather than silently
 * empty content — so a project can switch between the two sources without the
 * rest of the build noticing.
 */
import type { CollectionSchema } from './types-cms'
import type {
  SciFiContentItem,
  SciFiD1Options,
  SciFiCollectionInfo,
  SciFiSiteContentMode,
  SciFiSiteRouting
} from './types'

/**
 * Parse a site's `content_routes` JSON column: an object mapping collection name
 * to the prefix it is published under on that site. `null` means the site builds
 * the whole website (see the CMS's site-routing service).
 */
function parseContentRoutes(value: string | null): Record<string, string> | null {
  if (!value) {
    return null
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, string>
  } catch {
    return null
  }
}

const API_BASE = 'https://api.cloudflare.com/client/v4'

interface D1ResultRow {
  [column: string]: unknown
}

interface D1QueryResponse {
  success: boolean
  errors?: Array<{ code: number; message: string }>
  result?: Array<{ success: boolean; results?: D1ResultRow[]; error?: string }>
}

interface D1DatabaseListResponse {
  success: boolean
  errors?: Array<{ code: number; message: string }>
  result?: Array<{ uuid: string; name: string }>
}

export interface ContentRow extends D1ResultRow {
  id: string
  title: string
  slug: string
  status: string
  site_id: string | null
  data: string | null
  created_at: number
  updated_at: number
  published_at: number | null
}

/**
 * Resolved database ids, keyed by account + name. A build creates one client per
 * collection, and the lookup only has to happen once per process.
 */
const databaseIdCache = new Map<string, string>()

export class SciFiD1Client {
  private readonly options: SciFiD1Options
  private readonly site?: string
  private siteScopeResolved?: { sql: string; params: unknown[] }

  constructor(options: SciFiD1Options, site?: string) {
    this.options = options
    this.site = site
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.options.apiToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    })

    const json = (await res.json().catch(() => null)) as (T & {
      success?: boolean
      errors?: Array<{ code: number; message: string }>
    }) | null

    if (!res.ok || !json?.success) {
      const details = json?.errors?.map((e) => `${e.code} ${e.message}`).join('; ')
      throw new Error(
        `Cloudflare API ${init?.method ?? 'GET'} ${path} failed (${res.status})${details ? `: ${details}` : ''}`
      )
    }

    return json as T
  }

  /** The D1 database id, looked up by name once when only a name is configured. */
  private async resolveDatabaseId(): Promise<string> {
    if (this.options.databaseId) {
      return this.options.databaseId
    }

    const name = this.options.databaseName
    if (!name) {
      throw new Error('Sci-Fi CMS: neither databaseId nor databaseName was provided for the D1 source')
    }

    const cacheKey = `${this.options.accountId}:${name}`
    const cached = databaseIdCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const list = await this.request<D1DatabaseListResponse>(
      `/accounts/${this.options.accountId}/d1/database`
    )
    const match = (list.result ?? []).find((db) => db.name === name)
    if (!match) {
      throw new Error(
        `Sci-Fi CMS: D1 database "${name}" was not found in account ${this.options.accountId}`
      )
    }

    databaseIdCache.set(cacheKey, match.uuid)
    return match.uuid
  }

  /** Run one statement and return its rows. */
  async query<T extends D1ResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const databaseId = await this.resolveDatabaseId()
    const json = await this.request<D1QueryResponse>(
      `/accounts/${this.options.accountId}/d1/database/${databaseId}/query`,
      { method: 'POST', body: JSON.stringify({ sql, params }) }
    )

    const first = json.result?.[0]
    if (!first?.success) {
      throw new Error(
        `Sci-Fi CMS: D1 query failed${first?.error ? `: ${first.error}` : ''} (${sql})`
      )
    }

    return (first.results ?? []) as T[]
  }

  /**
   * The WHERE fragment that scopes rows to this build's site, matching
   * `content-site-scope.ts` on the Worker: a registered site sees its own
   * content plus shared content, an unidentified build on a multi-site
   * deployment sees shared content only, and a single-tenant deployment (no
   * sites registered) sees everything.
   */
  private async siteScope(): Promise<{ sql: string; params: unknown[] }> {
    if (this.siteScopeResolved) {
      return this.siteScopeResolved
    }

    if (!this.site) {
      const sites = await this.query<{ id: string }>(
        'SELECT id FROM sites WHERE is_active = 1 LIMIT 1'
      )
      const hasSites = sites.length > 0

      if (hasSites) {
        console.error(
          `[sci-fi-cms/astro] no \`site\` configured, so only shared content is returned (this deployment has registered sites). ` +
            'Set `site` in the loader options to read a site\'s content.'
        )
      }

      this.siteScopeResolved = hasSites
        ? { sql: '1 = 0', params: [] }
        // A single-tenant deployment (no sites at all) still sees everything.
        : { sql: '', params: [] }
      return this.siteScopeResolved
    }

    const rows = await this.query<{ id: string; slug: string }>(
      'SELECT id, slug FROM sites WHERE is_active = 1 AND (slug = ? OR id = ?) LIMIT 1',
      [this.site, this.site]
    )
    const site = rows[0]

    if (!site) {
      throw new Error(
        `site "${this.site}" was not recognised by the CMS (it is not registered, or is inactive). ` +
          'Register it in Admin → Sites, or check the slug.'
      )
    }

    // The site itself, the sites mounted on it (their content is published here) and every
    // item assigned to any of them. Assignment is the publication control (migration 053),
    // so an item assigned to no site is read by nobody.
    const mounted = await this.query<{ id: string }>(
      'SELECT id FROM sites WHERE parent_site_id = ? AND is_active = 1',
      [site.id]
    )
    const related = [site.id, ...mounted.map((row) => row.id)]
    const placeholders = related.map(() => '?').join(', ')
    this.siteScopeResolved = {
      sql:
        `(site_id IN (${placeholders}) OR id IN ` +
        `(SELECT content_id FROM content_sites WHERE site_id IN (${placeholders})))`,
      params: [...related, ...related]
    }
    return this.siteScopeResolved
  }

  /** Content items of a collection, in the shape the content API returns. */
  async fetchCollection(collection: string): Promise<SciFiContentItem[]> {
    const collections = await this.query<{ id: string }>(
      'SELECT id FROM collections WHERE name = ? AND is_active = 1 LIMIT 1',
      [collection]
    )
    const collectionRow = collections[0]
    if (!collectionRow) {
      throw new Error(`Collection "${collection}" not found in CMS`)
    }

    const scope = await this.siteScope()
    const where = ['collection_id = ?', ...(scope.sql ? [`(${scope.sql})`] : [])]
    // Ordered oldest first so a build's entry order is stable across runs; the
    // app sorts what it displays itself.
    const rows = await this.query<ContentRow>(
      `SELECT id, title, slug, status, site_id, data, created_at, updated_at, published_at
       FROM content
       WHERE ${where.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT 1000`,
      [collectionRow.id, ...scope.params]
    )

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      siteId: row.site_id ?? null,
      data: row.data ? JSON.parse(row.data) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at ?? null
    }))
  }

  /**
   * How this build's site is wired, read straight from the sites tables.
   *
   * This mirrors the CMS's `GET /api/site` (see `services/site-routing.ts` in
   * @sci-fi-cms/core) so a D1 build and an API build route content identically.
   */
  async fetchSiteRouting(site?: string): Promise<SciFiSiteRouting | null> {
    const target = site ?? this.site
    if (!target) {
      return null
    }

    const rows = await this.query<{
      id: string
      slug: string
      name: string
      provider: string
      cf_project_name: string | null
      content_routes: string | null
      content_mode: string | null
      publishes_app: number | null
      parent_site_id: string | null
    }>(
      `SELECT id, slug, name, provider, cf_project_name, content_routes, content_mode, publishes_app, parent_site_id
       FROM sites
       WHERE is_active = 1 AND (slug = ? OR id = ?)
       LIMIT 1`,
      [target, target]
    )
    const current = rows[0]
    if (!current) {
      return null
    }

    // Every active site, with its primary active custom domain (if any).
    const siteRows = await this.query<{
      id: string
      slug: string
      provider: string
      cf_project_name: string | null
      content_routes: string | null
      content_mode: string | null
      publishes_app: number | null
      parent_site_id: string | null
    }>(
      `SELECT id, slug, provider, cf_project_name, content_routes, content_mode, publishes_app, parent_site_id
       FROM sites
       WHERE is_active = 1`
    )
    const domainRows = await this.query<{ site_id: string; hostname: string; is_primary: number }>(
      `SELECT site_id, hostname, is_primary
       FROM site_domains
       WHERE status = 'active'
       ORDER BY is_primary DESC`
    )

    const baseUrlOf = (siteRow: { id: string; provider: string; cf_project_name: string | null }): string | null => {
      const domain = domainRows.find((row) => row.site_id === siteRow.id)?.hostname
      if (domain) {
        return `https://${domain}`
      }
      if (siteRow.provider === 'cloudflare-pages' && siteRow.cf_project_name) {
        return `https://${siteRow.cf_project_name}.pages.dev`
      }
      return null
    }

    const contentRoutes = parseContentRoutes(current.content_routes)
    // A row with no mode predates migration 052, when every site was deployed on its
    // own: that is what `standalone` means.
    const modeOf = (row: { content_routes: string | null; content_mode: string | null }) =>
      row.content_mode === 'paths'
        ? ('paths' as SciFiSiteContentMode)
        : ('standalone' as SciFiSiteContentMode)
    const contentMode = modeOf(current)
    // Only a deployed site with no content routes builds the website.
    const publishesWebsite = (row: { content_routes: string | null; content_mode: string | null }) =>
      modeOf(row) === 'standalone' && parseContentRoutes(row.content_routes) === null

    // A content host may ask for the website's routes beside its own content
    // (migration 055): then it publishes them itself.
    const publishesAppRoutes = (row: {
      content_routes: string | null
      content_mode: string | null
      publishes_app: number | null
    }) => modeOf(row) === 'standalone' && (parseContentRoutes(row.content_routes) === null || Number(row.publishes_app ?? 0) === 1)

    // The sites mounted on this one (migration 052) publish through it, at the prefixes
    // their own routes name.
    const children =
      contentMode === 'standalone'
        ? siteRows.filter((row) => row.parent_site_id === current.id)
        : []
    const mounts: Record<string, string> = {}
    for (const child of children) {
      for (const [collection, prefix] of Object.entries(parseContentRoutes(child.content_routes) ?? {})) {
        if (mounts[collection] === undefined) {
          mounts[collection] = prefix
        }
      }
    }

    const published = new Set([...Object.keys(contentRoutes ?? {}), ...Object.keys(mounts)])

    const external: Record<string, string> = {}
    for (const other of siteRows) {
      // A mounted site is published by its parent, so it is not a host of its own.
      if (other.id === current.id || modeOf(other) !== 'standalone') {
        continue
      }
      const base = baseUrlOf(other)
      if (!base) {
        continue
      }
      for (const [collection, prefix] of Object.entries(parseContentRoutes(other.content_routes) ?? {})) {
        if (published.has(collection) || external[collection]) {
          continue
        }
        external[collection] = `${base}${prefix.replace(/\/+$/, '')}`
      }
    }

    // The website itself is built by an active deployed site with no content routes. A
    // content-only host links back to it. Several sites can qualify (the same website
    // deployed as a Worker and to Pages), and a Worker with no custom domain has no host
    // to link to, so the first candidate with a resolvable base URL wins.
    const appSite = siteRows.find(
      (row) => row.id !== current.id && publishesWebsite(row) && baseUrlOf(row) !== null
    )

    // A mounted site links home to its parent: that is the host serving its content.
    const parent =
      contentMode === 'paths' && current.parent_site_id
        ? siteRows.find((row) => row.id === current.parent_site_id) ?? null
        : null
    const homeBase = parent ? baseUrlOf(parent) : appSite ? baseUrlOf(appSite) : null

    // A site that publishes the app's own routes serves them here, so its links to
    // them stay on this host instead of pointing at the website site.
    const publishesApp = publishesAppRoutes(current)

    return {
      slug: current.slug,
      name: current.name,
      domain: domainRows.find((row) => row.site_id === current.id)?.hostname ?? null,
      contentMode,
      parentSiteId: current.parent_site_id ?? null,
      parentSlug: parent?.slug ?? null,
      contentRoutes,
      publishesApp,
      mounts,
      external,
      appBaseUrl: publishesApp ? null : homeBase
    }
  }

  /** The collections the CMS exposes, with the URL prefix of each. */
  async fetchCollections(): Promise<SciFiCollectionInfo[]> {
    const rows = await this.query<{
      id: string
      name: string
      display_name: string
      url_prefix: string | null
    }>('SELECT id, name, display_name, url_prefix FROM collections WHERE is_active = 1')

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      urlPrefix: row.url_prefix ?? null
    }))
  }

  /** The collection's schema, as stored in the collections table. */
  async fetchCollectionSchema(collection: string): Promise<CollectionSchema | null> {
    const rows = await this.query<{ schema: string | null }>(
      'SELECT schema FROM collections WHERE name = ? AND is_active = 1 LIMIT 1',
      [collection]
    )
    const schema = rows[0]?.schema
    return schema ? (JSON.parse(schema) as CollectionSchema) : null
  }

  /** A single content item by id. */
  async fetchItem(collection: string, id: string): Promise<SciFiContentItem | null> {
    const items = await this.fetchCollection(collection)
    return items.find((item) => item.id === id) ?? null
  }
}
