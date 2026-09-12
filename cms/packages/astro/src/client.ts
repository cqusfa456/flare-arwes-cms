/**
 * Lightweight API client for Sci-Fi CMS.
 *
 * Used by both build-time and live Content Layer loaders
 * to fetch collection data and schemas from the CMS API.
 */
import type { CollectionSchema } from './types-cms'
import type { SciFiLoaderOptions, SciFiContentItem, SciFiApiResponse } from './types'

interface CollectionMeta {
  id: string
  name: string
  schema: CollectionSchema
  [key: string]: unknown
}

/**
 * Sci-Fi CMS API client.
 *
 * Handles authenticated requests, error recovery (returns empty data
 * instead of throwing to avoid crashing Astro builds), and typed responses.
 */
export class SciFiClient {
  private readonly apiUrl: string
  private readonly apiToken?: string
  private readonly site?: string

  constructor(options: Pick<SciFiLoaderOptions, 'apiUrl' | 'apiToken' | 'site'>) {
    // Strip trailing slash for consistent URL construction
    this.apiUrl = options.apiUrl.replace(/\/+$/, '')
    this.apiToken = options.apiToken
    this.site = options.site
  }

  /** Build request headers, including auth and site scope if configured. */
  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiToken) {
      h['X-API-Key'] = this.apiToken
    }
    // Scopes the response to this site's content plus shared content. Without
    // it, a deployment with registered sites returns shared content only.
    if (this.site) {
      h['X-Site'] = this.site
    }
    return h
  }

  /**
   * Fetch all content items for a collection.
   * Returns an empty array on network/API errors.
   */
  async fetchCollection(collection: string): Promise<SciFiContentItem[]> {
    try {
      const url = `${this.apiUrl}/api/collections/${collection}/content`
      const res = await fetch(url, { headers: this.headers() })

      if (!res.ok) {
        console.error(`[sci-fi-cms/astro] Failed to fetch collection "${collection}": ${res.status} ${res.statusText}`)
        return []
      }

      const json = await res.json() as SciFiApiResponse<SciFiContentItem>
      this.warnIfScopeIsUnexpected(collection, json)
      return json.data ?? []
    } catch (err) {
      console.error(`[sci-fi-cms/astro] Network error fetching collection "${collection}":`, err)
      return []
    }
  }

  /**
   * Surface a scope mismatch loudly: a build that silently renders zero items
   * because it forgot `site` is otherwise very hard to diagnose.
   */
  private warnIfScopeIsUnexpected(collection: string, json: SciFiApiResponse<SciFiContentItem>): void {
    const scope = json.meta?.siteScope
    if (!scope) return

    if (scope.mode === 'shared-only' && this.site) {
      console.error(
        `[sci-fi-cms/astro] "${collection}": site "${this.site}" was not recognised by the CMS (${scope.reason}). ` +
        'Register it in Admin → Sites, or check the slug.'
      )
      return
    }
    if (scope.mode === 'shared-only' && !this.site) {
      console.warn(
        `[sci-fi-cms/astro] "${collection}": no \`site\` configured, so only shared content is returned (${scope.reason}). ` +
        'Set `site` in the loader options to read a site\'s content.'
      )
      return
    }
    if (scope.mode === 'site+shared' && !this.site) {
      console.warn(
        `[sci-fi-cms/astro] "${collection}" was scoped to site "${scope.siteSlug}" but no \`site\` option is set; the scope came from the request.`
      )
    }
  }

  /**
   * Fetch the schema for a collection by looking it up in the collections list.
   * Returns null on error or if collection is not found.
   */
  async fetchCollectionSchema(collection: string): Promise<CollectionSchema | null> {
    try {
      const url = `${this.apiUrl}/api/collections`
      const res = await fetch(url, { headers: this.headers() })

      if (!res.ok) {
        console.error(`[sci-fi-cms/astro] Failed to fetch collections list: ${res.status} ${res.statusText}`)
        return null
      }

      const json = await res.json() as SciFiApiResponse<CollectionMeta>
      const match = json.data?.find((c) => c.name === collection)

      if (!match) {
        console.error(`[sci-fi-cms/astro] Collection "${collection}" not found in CMS`)
        return null
      }

      return match.schema ?? null
    } catch (err) {
      console.error(`[sci-fi-cms/astro] Network error fetching schema for "${collection}":`, err)
      return null
    }
  }

  /**
   * Fetch a single content item by ID.
   * Returns null on error or if item is not found.
   */
  async fetchItem(collection: string, id: string): Promise<SciFiContentItem | null> {
    try {
      const url = `${this.apiUrl}/api/collections/${collection}/content/${id}`
      const res = await fetch(url, { headers: this.headers() })

      if (!res.ok) {
        return null
      }

      const json = await res.json() as { data: SciFiContentItem }
      return json.data ?? null
    } catch (err) {
      console.error(`[sci-fi-cms/astro] Network error fetching item "${id}" from "${collection}":`, err)
      return null
    }
  }
}
