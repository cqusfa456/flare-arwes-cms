/**
 * Build-time collection routing.
 *
 * Each collection records the path its entries are published under (`url_prefix`
 * in the CMS, editable at Admin → Collections), so the site no longer hardcodes
 * "docs under /docs, pages under /blog". Every path in the build comes from here.
 */
import { SciFiClient, SciFiD1Client } from '@sci-fi-cms/astro'

import { API_TOKEN, API_URL, D1, SITE } from './cms-source'

/** Collection name → URL prefix. `''` is the site root, `null` is not routed. */
export type CollectionPrefixes = Map<string, string | null>

let pending: Promise<CollectionPrefixes> | null = null

/** Read the collection prefixes from the CMS, once per build. */
export const getCollectionPrefixes = (): Promise<CollectionPrefixes> => {
  if (!pending) {
    pending = (async () => {
      const client = D1
        ? new SciFiD1Client(D1, SITE)
        : new SciFiClient({ apiUrl: API_URL, apiToken: API_TOKEN, site: SITE })

      const collections = await client.fetchCollections()

      if (collections.length === 0) {
        console.warn(
          '[routing] The CMS returned no collections; CMS pages will not be generated. ' +
            'Check the D1 credentials or PUBLIC_SCIFI_API_URL.'
        )
      }

      const prefixes: CollectionPrefixes = new Map()
      for (const collection of collections) {
        prefixes.set(collection.name, collection.urlPrefix)
      }
      return prefixes
    })()
  }
  return pending
}

/**
 * Public path of one entry: the collection's prefix plus the slug.
 *
 * The trailing slash matters: the site is built with `build.format: 'directory'`,
 * so `/blog/post/` is the canonical URL and `/blog/post` answers with a redirect.
 *
 * Returns null when the collection has no prefix recorded (not published on its
 * own), so callers can skip it instead of generating a broken URL.
 */
export const contentPath = (prefix: string | null | undefined, slug: string): string | null => {
  if (prefix === null || prefix === undefined) {
    return null
  }
  const base = prefix.replace(/\/+$/, '')
  const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '')
  return `${base}/${cleanSlug}/`
}

/** The prefix itself as a path (`/blog`), or null when the collection is not routed. */
export const collectionIndexPath = (prefix: string | null | undefined): string | null => {
  if (prefix === null || prefix === undefined || prefix === '') {
    return null
  }
  return prefix.replace(/\/+$/, '')
}

/** The prefix as the canonical URL of its index page (`/blog/`). */
export const collectionIndexUrl = (prefix: string | null | undefined): string | null => {
  const path = collectionIndexPath(prefix)
  return path === null ? null : `${path}/`
}
