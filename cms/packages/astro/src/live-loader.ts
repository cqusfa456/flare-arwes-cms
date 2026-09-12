/**
 * Live loader for Sci-Fi CMS — requires Astro 5.10+ with
 * experimental.liveContentCollections enabled.
 */
import type { LiveLoader } from 'astro/loaders'
import type { SciFiLoaderOptions, SciFiContentItem } from './types'
import { SciFiClient } from './client'

/**
 * Map a Sci-Fi content item to the shape expected by Astro's Content Layer.
 */
function mapItemToEntry(item: SciFiContentItem): { id: string; data: Record<string, unknown> } {
  return {
    id: item.id,
    data: {
      title: item.title,
      slug: item.slug,
      ...item.data,
      _status: item.status,
      _createdAt: new Date(item.created_at),
      _updatedAt: new Date(item.updated_at),
    },
  }
}

/**
 * @experimental Live loader for Sci-Fi CMS.
 *
 * Fetches content at request time for SSR pages. Requires Astro 5.10+
 * with `experimental.liveContentCollections` enabled in astro.config.
 *
 * @example
 * ```ts
 * import { sciFiLiveLoader } from '@sci-fi-cms/astro'
 *
 * const posts = defineCollection({
 *   loader: sciFiLiveLoader({
 *     apiUrl: 'http://localhost:8787',
 *     collection: 'blog-posts',
 *     filter: { status: 'published' },
 *   }),
 * })
 * ```
 */
export function sciFiLiveLoader(options: SciFiLoaderOptions): LiveLoader<Record<string, unknown>> {
  return {
    name: 'sci-fi-live-loader',

    loadCollection: async ({ filter }) => {
      const client = new SciFiClient({
        apiUrl: options.apiUrl,
        apiToken: options.apiToken,
        site: options.site,
      })

      try {
        let items = await client.fetchCollection(options.collection)
        console.log(`[sci-fi-live] ${options.collection}: fetched ${items?.length ?? 0} items`)

        // Client-side filtering (API filters are broken, so we filter here)
        const statusFilter = options.filter?.status || (filter as any)?.status
        if (statusFilter) {
          items = items.filter((item) => item.status === statusFilter)
        }

        return {
          entries: items.map(mapItemToEntry),
        }
      } catch (err) {
        console.error(`[sci-fi-live] ${options.collection} error:`, err)
        return { error: new Error(`Failed to load ${options.collection}: ${err}`) }
      }
    },

    loadEntry: async ({ filter }) => {
      const client = new SciFiClient({
        apiUrl: options.apiUrl,
        apiToken: options.apiToken,
        site: options.site,
      })

      const id = typeof filter === 'string' ? filter : (filter as any).id
      const item = await client.fetchItem(options.collection, id)

      if (!item) {
        return { error: new Error(`Entry "${id}" not found in "${options.collection}"`) }
      }

      return mapItemToEntry(item)
    },
  }
}
