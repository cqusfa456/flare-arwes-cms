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
import type { SciFiContentItem, SciFiD1Options, SciFiCollectionInfo } from './types'

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

      this.siteScopeResolved = hasSites ? { sql: 'site_id IS NULL', params: [] } : { sql: '', params: [] }
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

    this.siteScopeResolved = { sql: '(site_id = ? OR site_id IS NULL)', params: [site.id] }
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
