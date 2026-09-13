/**
 * Astro Content Layer Loader Types for Sci-Fi CMS
 */

/**
 * Read content straight out of the deployment's D1 database through the
 * Cloudflare API instead of the CMS HTTP API. Builds use this so the database is
 * the source of truth and the build does not depend on the Worker (or its
 * response cache).
 */
export interface SciFiD1Options {
  /** Cloudflare account that owns the database. */
  accountId: string

  /** D1 database id. Takes precedence over `databaseName`. */
  databaseId?: string

  /** D1 database name, looked up once through the Cloudflare API. */
  databaseName?: string

  /** Token with D1 read access. */
  apiToken: string
}

/**
 * Configuration options for the Sci-Fi CMS Astro loader.
 */
export interface SciFiLoaderOptions {
  /**
   * CMS API base URL (e.g., 'http://localhost:8787'). Optional when `d1` is
   * configured, since the loader then reads the database directly.
   */
  apiUrl?: string

  /**
   * Read from D1 through the Cloudflare API instead of `apiUrl`.
   *
   * Only usable at build time (it needs a Cloudflare token), which is exactly
   * where the Content Layer loader runs.
   */
  d1?: SciFiD1Options

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
