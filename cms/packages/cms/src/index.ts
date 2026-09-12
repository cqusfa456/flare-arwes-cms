/**
 * Sci-Fi CMS Application
 *
 * Entry point for your Sci-Fi CMS headless application
 */

import {
  createSciFiApp,
  registerCollections,
  resolveStorage,
  SchedulerService
} from '@sci-fi-cms/core'
import type { SciFiConfig } from '@sci-fi-cms/core'
import { validateBindingsMiddleware } from './middleware/validate-bindings'

// Import your collection configurations
// Add new collections here after creating them in src/collections/
import blogPostsCollection from './collections/blog-posts.collection'
import docsSectionsCollection from './collections/docs-sections.collection'
import docsCollection from './collections/docs.collection'

// Register collections BEFORE creating the app
// This ensures they are synced to the database on startup
registerCollections([
  blogPostsCollection,
  docsSectionsCollection,
  docsCollection,
])

// Application configuration
const config: SciFiConfig = {
  collections: {
    autoSync: true
  },
  plugins: {
    directory: './src/plugins',
    autoLoad: false  // Set to true to auto-load custom plugins
  },
  middleware: {
    beforeAuth: [validateBindingsMiddleware()]
  }
}

// Create the application
const app = createSciFiApp(config)

/**
 * Resolve the media storage backend from environment configuration.
 *
 * Which backend is active is decided entirely by `STORAGE_BACKEND` plus the
 * matching provider variables/secrets (see `resolveStorage` in @sci-fi-cms/core):
 *
 *   - unset / `r2`  → Cloudflare R2 `MEDIA_BUCKET` binding (default)
 *   - `b2`          → Backblaze B2 over the S3-compatible API
 *   - `s3`          → any S3-compatible endpoint (AWS S3, MinIO, ...)
 *
 * The resolved bucket and a credential-free description (`STORAGE_INFO`) are
 * injected into the env handed to Hono, so routes, the admin UI and the system
 * API all report the same backend.
 *
 * Resolution fails closed: when a non-default backend is requested but its
 * configuration is incomplete, `MEDIA_BUCKET` is left unset and requests are
 * rejected with the missing variable names instead of silently using R2.
 */
const withStorage = (env: any): any => {
  const { bucket, info } = resolveStorage(env)

  if (info.error) {
    console.error(`[storage] ${info.error}`)
  }
  for (const warning of info.warnings) {
    console.warn(`[storage] ${warning}`)
  }

  const resolved: any = { ...env, STORAGE_INFO: info }

  if (bucket) {
    resolved.MEDIA_BUCKET = bucket
  } else {
    delete resolved.MEDIA_BUCKET
  }

  return resolved
}

// Export Workers module with both fetch and scheduled handlers.
// Both paths resolve storage so scheduled publishing (and anything else running
// off the cron trigger) sees exactly the same backend as HTTP traffic.
export default {
  fetch(request: Request, env: any, ctx: ExecutionContext) {
    return app.fetch(request, withStorage(env), ctx)
  },
  async scheduled(_controller: ScheduledController, env: any, ctx: ExecutionContext) {
    const storageEnv = withStorage(env)
    const scheduler = new SchedulerService(storageEnv.DB, storageEnv, ctx)
    ctx.waitUntil(scheduler.processScheduledContent())
  },
}
