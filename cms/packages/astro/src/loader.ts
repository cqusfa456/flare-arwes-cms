/**
 * Build-time Astro Content Layer Loader for Sci-Fi CMS.
 *
 * Loads content at build time into Astro's content store for type-safe
 * `getCollection()` queries, either from the CMS HTTP API or — with `d1` — from
 * the deployment's D1 database through the Cloudflare API.
 */
import type { Loader } from 'astro/loaders'
import type { SciFiLoaderOptions } from './types'
import { SciFiClient } from './client'
import { SciFiD1Client } from './d1-client'
import { sciFiSchemaToZod } from './schema'

/**
 * The content source. Both clients expose the same small surface, so the loader
 * body does not care which one it got.
 */
const createClient = (options: SciFiLoaderOptions): SciFiClient | SciFiD1Client =>
  options.d1
    ? new SciFiD1Client(options.d1, options.site)
    : new SciFiClient({
        apiUrl: options.apiUrl,
        apiToken: options.apiToken,
        site: options.site,
      })

/** Where the loader is reading from, for the build log. */
const describeSource = (options: SciFiLoaderOptions): string =>
  options.d1
    ? `D1 (${options.d1.databaseId ?? options.d1.databaseName ?? 'unknown database'})`
    : String(options.apiUrl)

/**
 * Create an Astro Content Layer loader for a Sci-Fi CMS collection.
 *
 * @example
 * ```ts
 * // content.config.ts
 * import { defineCollection } from 'astro:content'
 * import { sciFiLoader } from '@sci-fi-cms/astro'
 *
 * export const collections = {
 *   posts: defineCollection({
 *     loader: sciFiLoader({
 *       apiUrl: 'http://localhost:8787',
 *       collection: 'blog-posts',
 *       filter: { status: 'published' },
 *     }),
 *   }),
 * }
 * ```
 *
 * Reading the database directly (build machines holding a Cloudflare token):
 *
 * ```ts
 * loader: sciFiLoader({
 *   d1: {
 *     accountId: process.env.CF_ACCOUNT_ID!,
 *     databaseName: 'sci-fi-cms-db',
 *     apiToken: process.env.CF_API_TOKEN!,
 *   },
 *   site: 'my-site',
 *   collection: 'pages',
 * })
 * ```
 */
export function sciFiLoader(options: SciFiLoaderOptions): Loader {
  return {
    name: 'sci-fi-loader',

    load: async ({ store, meta, logger, parseData, generateDigest }) => {
      const client = createClient(options)

      logger.info(`Fetching "${options.collection}" from ${describeSource(options)}`)

      // The HTTP API client swallows network/API errors (it logs them and
      // returns an empty list) so an unreachable CMS does not break a build.
      // Reading D1 is a build-time configuration step instead: a failure there
      // means the content is unknown, and continuing would deploy a site with
      // empty collections, so it fails the build.
      let items
      try {
        items = await client.fetchCollection(options.collection)
      } catch (error) {
        if (options.d1) {
          logger.error(`Failed to read "${options.collection}" from D1: ${error}`)
          throw error
        }
        logger.warn(`Failed to fetch "${options.collection}" from CMS: ${error}`)
        logger.warn('Build will continue with cached content if available')
        return
      }

      if (!items || items.length === 0) {
        logger.info(`No content found for "${options.collection}"`)
        store.clear()
        return
      }

      // Client-side filtering (API filters are broken — known bug)
      let filtered = items
      if (options.filter?.status) {
        filtered = items.filter((item) => item.status === options.filter!.status)
      }

      logger.info(`Processing ${filtered.length} entries for "${options.collection}"`)

      store.clear()

      for (const item of filtered) {
        // Flatten item.data to top level, merge top-level fields and system fields
        // The CMS API returns title/slug at root level AND user fields inside item.data
        const flatData: Record<string, any> = {
          title: item.title,
          slug: item.slug,
          ...item.data,
          _status: item.status,
          _createdAt: new Date(item.created_at),
          _updatedAt: new Date(item.updated_at),
          // Publish date (undefined while unpublished). Declared as a system
          // field because a CMS collection schema cannot declare it.
          _publishedAt: item.published_at ? new Date(item.published_at) : undefined,
        }

        // Sanitize invalid dates — CMS may store empty strings for date fields
        // which produce Invalid Date and crash Astro's Zod validation
        for (const [key, val] of Object.entries(flatData)) {
          if (val instanceof Date && isNaN(val.getTime())) {
            flatData[key] = undefined
          } else if (typeof val === 'string' && val === '') {
            // Empty strings on date/datetime schema fields also crash z.coerce.date()
            // Safe to convert to undefined — Zod .optional() handles it
            flatData[key] = undefined
          }
        }

        const data = await parseData({
          id: item.id,
          data: flatData,
        })

        store.set({
          id: item.id,
          data,
          digest: generateDigest(data),
        })
      }

      meta.set('lastModified', new Date().toISOString())
      logger.info(`Stored ${filtered.length} entries for "${options.collection}"`)
    },

    schema: async () => {
      // If user provided a custom schema, use it
      if (options.schema) {
        return options.schema
      }

      // Otherwise, dynamically fetch from CMS and convert
      const client = createClient(options)

      try {
        const collectionSchema = await client.fetchCollectionSchema(options.collection)
        if (collectionSchema) {
          return sciFiSchemaToZod(collectionSchema)
        }
      } catch {
        // Schema fetch failed — fall through to permissive schema
      }

      // Fallback: permissive schema that accepts any data
      const { z } = await import('astro/zod')
      const safeDate = z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : val),
        z.coerce.date(),
      )
      return z.object({
        _status: z.string().optional(),
        _createdAt: safeDate.optional(),
        _updatedAt: safeDate.optional(),
        _publishedAt: safeDate.optional(),
      }).passthrough()
    },
  }
}
