/**
 * @sci-fi-cms/astro — Astro Content Layer integration for Sci-Fi CMS
 *
 * Provides a build-time Content Layer loader, schema conversion,
 * and API client for fetching CMS content at build time.
 */

export { sciFiLoader } from './loader'
/** @experimental Requires Astro 5.10+ with experimental.liveContentCollections */
export { sciFiLiveLoader } from './live-loader'
export { sciFiSchemaToZod } from './schema'
export { SciFiClient } from './client'
export { SciFiD1Client } from './d1-client'
export type {
  SciFiLoaderOptions,
  SciFiContentItem,
  SciFiApiResponse,
  SciFiD1Options,
  SciFiCollectionInfo,
  SciFiSiteRouting
} from './types'
