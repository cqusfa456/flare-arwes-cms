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
 * A collection as the CMS describes it, including where its entries are
 * published. Lets a build generate paths from CMS settings instead of hardcoding
 * them.
 */
export interface SciFiCollectionInfo {
  id: string
  name: string
  displayName: string

  /**
   * Path prefix the collection's entries are published under:
   * `''` is the site root, `'/docs'` is a path prefix, `null` means the
   * collection is not routed on its own (it only groups other entries).
   */
  urlPrefix: string | null
}

/**
 * How a site publishes; mirrors `SiteContentMode` in @sci-fi-cms/core.
 *
 * `standalone` is deployed on its own: it publishes the website when it declares no
 * content routes, or just the collections its routes name when it does. `paths` is
 * not deployed — the parent site publishes its content at the prefixes its routes
 * name, which is how one host can serve `/blog` and `/docs`.
 */
export type SciFiSiteContentMode = 'paths' | 'standalone'

/**
 * How a site is wired: which collections it publishes, under which prefixes, and
 * where the rest of the deployment lives.
 *
 * Read from the CMS at build time, so one repository can build the website and a
 * content-only host (e.g. a blog subdomain) from the same code.
 */
export interface SciFiSiteRouting {
  slug: string
  name: string

  /** The site's primary custom domain, when it has one. */
  domain: string | null

  /**
   * How this site publishes; see `SiteContentMode` in @sci-fi-cms/core.
   *
   * `standalone` — deployed on its own: it publishes the website when it declares no
   * content routes, or just the collections its routes name when it does.
   * `paths` — not deployed; the parent site (`parentSiteId`) publishes its content at
   * the prefixes its routes name.
   */
  contentMode: SciFiSiteContentMode

  /** The site this one is mounted on, when it publishes in `paths` mode. */
  parentSiteId: string | null

  /** The parent's slug, for a build that reports where its content is published. */
  parentSlug: string | null

  /**
   * Collection name → the prefix it is published under **on this site**.
   *
   * `null` on a deployed site that declares no routes (it publishes the website and
   * every collection at the collection's own `url_prefix`); otherwise the set of
   * collections this host serves, at the prefixes given — a collection missing from it
   * keeps its own `url_prefix`.
   */
  contentRoutes: Record<string, string> | null

  /**
   * Whether this build publishes the website's own routes (migration 055): true for
   * the site that builds the website itself, and for a content host that asked for
   * them beside its own collections. Such a build generates them *and* lets the
   * collection it routed at `''` keep the root, so a documentation host can serve
   * `/docs` and still show its own index on the front page.
   */
  publishesApp: boolean

  /**
   * What the sites mounted on this one publish, as collection → prefix (migration 052).
   * Merged into this build prefixes, so a mounted site content appears on this host.
   */
  mounts: Record<string, string>

  /** Absolute base URL of a collection published on another site, by collection name. */
  external: Record<string, string>

  /** Base URL of the site that builds the website, for a content-only site's links home. */
  appBaseUrl: string | null
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
