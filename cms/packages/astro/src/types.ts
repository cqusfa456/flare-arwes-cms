/**
 * Astro Content Layer Loader Types for Sci-Fi CMS
 */

/**
 * Configuration options for the Sci-Fi CMS Astro loader.
 */
export interface SciFiLoaderOptions {
  /** CMS API base URL (e.g., 'http://localhost:8787') */
  apiUrl: string

  /** Collection name in Sci-Fi CMS (e.g., 'blog-posts') */
  collection: string

  /** Optional API token for authenticated access */
  apiToken?: string

  /**
   * Site this build belongs to (a slug or id registered in Admin → Sites).
   *
   * Sent as `X-Site`, which scopes every request to that site's content plus
   * shared content. Omit it only for a single-tenant deployment: once any site
   * is registered, an unidentified request sees **shared content only**.
   */
  site?: string

  /** Filter content by status or custom fields */
  filter?: {
    status?: 'draft' | 'published' | 'archived'
    [key: string]: string | undefined
  }

  /** Override auto-generated Zod schema */
  schema?: any
}

/**
 * Shape of a content item returned by the Sci-Fi CMS API.
 */
export interface SciFiContentItem {
  id: string
  title: string
  slug: string
  status: string
  /** Owning site id, or null for shared content. */
  siteId?: string | null
  data: Record<string, unknown>
  created_at: number
  updated_at: number
  /** Publish timestamp (ms), or null when the item is not published. */
  published_at?: number | null
}

/**
 * Shape of a paginated API response from Sci-Fi CMS.
 */
export interface SciFiApiResponse<T> {
  data: T[]
  meta: {
    count: number
    timestamp: string
    cache: {
      hit: boolean
      source: string
    }
    /** How the CMS scoped this response to a site (useful when a build is empty). */
    siteScope?: {
      mode: 'all' | 'site+shared' | 'shared-only'
      siteSlug: string | null
      identifiedBy: 'header' | 'query' | 'none'
      reason: string
    }
  }
}
