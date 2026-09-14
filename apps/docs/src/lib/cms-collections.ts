/**
 * Build-time routing.
 *
 * Two layers decide where content is published:
 *
 * 1. Each collection records the path its entries are published under
 *    (`collections.url_prefix`, editable at Admin → Collections).
 * 2. A site (Admin → Sites) declares a publishing mode and, with it,
 *    `content_routes`: the collections it names and the prefix each is published
 *    under. A `paths` site publishes the website itself — its own routes and every
 *    collection, at the collection's own prefix unless overridden (`/blog`,
 *    `/docs`, ...). A `standalone` site is a host of its own: it publishes only the
 *    collections it names, at its own root.
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
   * How the site publishes; see the CMS's `SiteContentMode`.
   *
   * `standalone` is deployed on its own: it publishes the website when it declares no
   * content routes, or just the collections its routes name when it does. `paths` is
   * published by its parent, so this build is not supposed to run at all.
   */
  mode: 'paths' | 'standalone'

  /** The site this one is mounted on, when it publishes in paths mode. */
  parentSlug: string | null

  /**
   * Collections this site publishes, with their prefix on this site. `null` for a
   * site that publishes the website; {@link overrides} then carries the prefixes it
   * changes, if any.
   */
  routes: Map<string, string> | null

  /**
   * Prefixes this build changes for the collections it names: its own content routes,
   * plus what the sites mounted on it declare (migration 052). A collection missing
   * here keeps its own `url_prefix`.
   */
  overrides: Map<string, string>

  /** Absolute URLs of collections published on another site, by collection name. */
  external: Map<string, string>

  /** Base URL of the website, when this build is a content-only host. */
  appBaseUrl: string | null
}

let routingPromise: Promise<SiteRoutingInfo> | null = null
let collectionsPromise: Promise<CollectionPrefixes> | null = null

const createClient = (): SciFiClient | SciFiD1Client =>
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
          mode: 'standalone' as const,
          parentSlug: null,
          routes: null,
          overrides: new Map<string, string>(),
          external: new Map<string, string>(),
          appBaseUrl: null
        }
      }

      // A deployed site that declares routes publishes *just* those collections; one
      // that declares none publishes the website, with the prefixes its mounted sites
      // ask for (migration 052) on top of each collection's own.
      const contentRoutes = routing.contentRoutes
        ? new Map(Object.entries(routing.contentRoutes))
        : null
      const routes = routing.contentMode === 'standalone' ? contentRoutes : null
      const overrides = new Map<string, string>(Object.entries(routing.mounts ?? {}))
      for (const [collection, prefix] of contentRoutes ?? []) {
        overrides.set(collection, prefix)
      }

      if (routes) {
        console.info(
          `[routing] "${routing.slug}" is a content-only site: publishes ${[...routes.keys()].join(', ') || 'nothing'}`
        )
      } else if (overrides.size > 0) {
        console.info(
          `[routing] "${routing.slug}" publishes the website, with ${[...overrides.keys()].join(', ')} under a declared prefix`
        )
      }

      return {
        slug: routing.slug,
        mode: routing.contentMode,
        parentSlug: routing.parentSlug ?? null,
        routes,
        overrides,
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
 * A site that publishes the website uses the collections' own `url_prefix`, with
 * the overrides it declares on top; a content-only site publishes only the
 * collections it declares, so anything else resolves to `undefined` and is simply
 * not generated.
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
        // A collection another site claims has moved to that host: this build
        // links to it (routing.external) instead of generating it locally.
        if (routing.external.has(collection.name)) {
          continue
        }
        // An override that is empty keeps the collection's own prefix: on a site
        // that publishes the website, '' would otherwise mean its root.
        const override = routing.overrides.get(collection.name)
        prefixes.set(
          collection.name,
          override === undefined || override === '' ? collection.urlPrefix : override
        )
      }
      return prefixes
    })()
  }
  return collectionsPromise
}

/** True when this build publishes the website's own routes. */
export const isAppSite = async (): Promise<boolean> => {
  const routing = await getSiteRouting()
  return routing.mode === 'standalone' && routing.routes === null
}

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

/**
 * Path a `pages` entry is published at.
 *
 * `index` (or `home`) is the collection's own front page — with the default empty
 * prefix that is the site root, which is how the home page is managed in the CMS.
 */
export const pagePath = (slug: string, prefix: string | null | undefined): string | null => {
  const clean = String(slug ?? '')
  return clean === 'index' || clean === 'home'
    ? collectionIndexPath(prefix)
    : contentPath(prefix, clean)
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
