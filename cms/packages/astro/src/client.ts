/**
 * Lightweight API client for Flare CMS.
 *
 * Used by both build-time and live Content Layer loaders
 * to fetch collection data and schemas from the CMS API.
 */
import type { CollectionSchema } from './types-cms'
import type { FlareLoaderOptions, FlareContentItem, FlareApiResponse } from './types'

interface CollectionMeta {
  id: string
  name: string
  schema: CollectionSchema
  [key: string]: unknown
}

/**
 * Flare CMS API client.
 *
 * Handles authenticated requests, error recovery (returns empty data
 * instead of throwing to avoid crashing Astro builds), and typed responses.
 */
export class FlareClient {
  private readonly apiUrl: string
  private readonly apiToken?: string
  private readonly site?: string

  constructor(options: Pick<FlareLoaderOptions, 'apiUrl' | 'apiToken' | 'site'>) {
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
  async fetchCollection(collection: string): Promise<FlareContentItem[]> {
    try {
      const url = `${this.apiUrl}/api/collections/${collection}/content`
      const res = await fetch(url, { headers: this.headers() })

      if (!res.ok) {
        console.error(`[flare-cms/astro] Failed to fetch collection "${collection}": ${res.status} ${res.statusText}`)
        return []
      }

      const json = await res.json() as FlareApiResponse<FlareContentItem>
      this.warnIfScopeIsUnexpected(collection, json)
      return json.data ?? []
    } catch (err) {
      console.error(`[flare-cms/astro] Network error fetching collection "${collection}":`, err)
      return []
    }
  }

  /**
   * Surface a scope mismatch loudly: a build that silently renders zero items
   * because it forgot `site` is otherwise very hard to diagnose.
   */
  private warnIfScopeIsUnexpected(collection: string, json: FlareApiResponse<FlareContentItem>): void {
    const scope = json.meta?.siteScope
    if (!scope) return

    if (scope.mode === 'shared-only' && this.site) {
      console.error(
        `[flare-cms/astro] "${collection}": site "${this.site}" was not recognised by the CMS (${scope.reason}). ` +
        'Register it in Admin → Sites, or check the slug.'
      )
      return
    }
    if (scope.mode === 'shared-only' && !this.site) {
      console.warn(
        `[flare-cms/astro] "${collection}": no \`site\` configured, so only shared content is returned (${scope.reason}). ` +
        'Set `site` in the loader options to read a site\'s content.'
      )
      return
    }
    if (scope.mode === 'site+shared' && !this.site) {
      console.warn(
        `[flare-cms/astro] "${collection}" was scoped to site "${scope.siteSlug}" but no \`site\` option is set; the scope came from the request.`
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
        console.error(`[flare-cms/astro] Failed to fetch collections list: ${res.status} ${res.statusText}`)
        return null
      }

      const json = await res.json() as FlareApiResponse<CollectionMeta>
      const match = json.data?.find((c) => c.name === collection)

      if (!match) {
        console.error(`[flare-cms/astro] Collection "${collection}" not found in CMS`)
        return null
      }

      return match.schema ?? null
    } catch (err) {
      console.error(`[flare-cms/astro] Network error fetching schema for "${collection}":`, err)
      return null
    }
  }

  /**
   * Fetch a single content item by ID.
   * Returns null on error or if item is not found.
   */
  async fetchItem(collection: string, id: string): Promise<FlareContentItem | null> {
    try {
      const url = `${this.apiUrl}/api/collections/${collection}/content/${id}`
      const res = await fetch(url, { headers: this.headers() })

      if (!res.ok) {
        return null
      }

      const json = await res.json() as { data: FlareContentItem }
      return json.data ?? null
    } catch (err) {
      console.error(`[flare-cms/astro] Network error fetching item "${id}" from "${collection}":`, err)
      return null
    }
  }
}
