/**
 * Build-time routing.
 *
 * Two layers decide where content is published:
 *
 * 1. Each collection records the path its entries are published under
 *    (`collections.url_prefix`, editable at Admin → Collections).
 * 2. A site (Admin → Sites) may declare `content_routes`: the collections it
 *    publishes itself, and at which prefix. A site without it is the "app site"
 *    and builds the whole website; a site with it is a content-only host, so the
 *    same repository can build e.g. a blog subdomain that publishes only the blog
 *    at its own root.
 *
 * Everything the build generates comes from here, so no path is hardcoded.
 */
import { SciFiClient, SciFiD1Client } from '@sci-fi-cms/astro'

import { API_TOKEN, API_URL, D1, SITE } from './cms-source'

/** Collection name → URL prefix. `''` is the site root, `null` is not routed. */
export type CollectionPrefixes = Map<string, string | null | undefined>

export type SiteRoutingInfo = {
  /** Site slug this build belongs to, when the CMS knows it. */
  slug: string | null

  /**
   * Collections this site publishes, with their prefix on this site. `null` for
   * the app site, which publishes the website plus every routed collection at the
   * collection's own prefix.
   */
  routes: Map<string, string> | null

  /** Absolute URLs of collections published on another site, by collection name. */
  external: Map<string, string>

  /** Base URL of the website, when this build is a content-only host. */
  appBaseUrl: string | null
}

let routingPromise: Promise<SiteRoutingInfo> | null = null
let collectionsPromise: Promise<CollectionPrefixes> | null = null

const createClient = () =>
  D1
    ? new SciFiD1Client(D1, SITE)
    : new SciFiClient({ apiUrl: API_URL, apiToken: API_TOKEN, site: SITE })

/** The site routing, read once per build. */
export const getSiteRouting = (): Promise<SiteRoutingInfo> => {
  if (!routingPromise) {
    routingPromise = (async () => {
      const routing = await createClient().fetchSiteRouting(SITE)

      if (!routing) {
        console.warn(
          `[routing] The CMS does not know the site "${SITE ?? '(unset)'}"; ` +
            'this build publishes the website and every collection at its own prefix.'
        )
        return {
          slug: SITE ?? null,
          routes: null,
          external: new Map<string, string>(),
          appBaseUrl: null
        }
      }

      const routes = routing.contentRoutes ? new Map(Object.entries(routing.contentRoutes)) : null

      if (routes) {
        console.info(
          `[routing] "${routing.slug}" is a content-only site: publishes ${[...routes.keys()].join(', ') || 'nothing'}`
        )
      }

      return {
        slug: routing.slug,
        routes,
        external: new Map(Object.entries(routing.external)),
        appBaseUrl: routing.appBaseUrl
      }
    })()
  }
  return routingPromise
}

/**
 * Prefix of every collection on this build's site.
 *
 * On the app site these are the collections' own `url_prefix`; on a content-only
 * site only the collections it declares appear, so anything else resolves to
 * `undefined` and is simply not generated.
 */
export const getCollectionPrefixes = (): Promise<CollectionPrefixes> => {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const [routing, collections] = await Promise.all([
        getSiteRouting(),
        createClient().fetchCollections()
      ])

      const prefixes: CollectionPrefixes = new Map()

      if (routing.routes) {
        for (const [name, prefix] of routing.routes) {
          prefixes.set(name, prefix)
        }
        return prefixes
      }

      for (const collection of collections) {
        prefixes.set(collection.name, collection.urlPrefix)
      }
      return prefixes
    })()
  }
  return collectionsPromise
}

/** True when this build publishes the website's own routes. */
export const isAppSite = async (): Promise<boolean> => (await getSiteRouting()).routes === null

const stripTrailing = (value: string): string => value.replace(/\/+$/, '')

/**
 * Public path of one entry: the collection's prefix plus the slug.
 *
 * The trailing slash matters: the site is built with `build.format: 'directory'`,
 * so `/blog/post/` is the canonical URL and `/blog/post` answers with a redirect.
 *
 * Returns null when the collection is not published on this site, so callers skip
 * it instead of generating a broken URL.
 */
export const contentPath = (prefix: string | null | undefined, slug: string): string | null => {
  if (prefix === null || prefix === undefined) {
    return null
  }
  const base = stripTrailing(prefix)
  const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '')
  return `${base}/${cleanSlug}/`
}

/** Path (no trailing slash) of a collection's index: `/` when it is the site root. */
export const collectionIndexPath = (prefix: string | null | undefined): string | null => {
  if (prefix === null || prefix === undefined) {
    return null
  }
  const base = stripTrailing(prefix)
  return base === '' ? '/' : base
}

/** URL (canonical, with trailing slash) of a collection's index. */
export const collectionIndexUrl = (prefix: string | null | undefined): string | null => {
  const path = collectionIndexPath(prefix)
  return path === null ? null : path === '/' ? '/' : `${path}/`
}

/**
 * Link to a collection's index from this build: local when this site publishes it,
 * otherwise the absolute URL of the site that does.
 */
export const collectionIndexHref = async (name: string): Promise<string | null> => {
  const [routing, prefixes] = await Promise.all([getSiteRouting(), getCollectionPrefixes()])
  const prefix = prefixes.get(name)
  if (prefix !== null && prefix !== undefined) {
    return collectionIndexUrl(prefix)
  }
  return routing.external.get(name) ?? null
}
