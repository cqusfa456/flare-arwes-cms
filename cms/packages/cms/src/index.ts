/**
 * Flare CMS Application
 *
 * Entry point for your Flare CMS headless application
 */

import { createFlareApp, registerCollections, SchedulerService } from '@flare-cms/core'
import type { FlareConfig } from '@flare-cms/core'
import { validateBindingsMiddleware } from './middleware/validate-bindings'
import { B2Storage } from './storage/b2-storage'

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
const config: FlareConfig = {
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
const app = createFlareApp(config)

// Storage backend selection.
// By default the app uses Cloudflare R2 (MEDIA_BUCKET binding).
// Set STORAGE_BACKEND=b2 to use a private Backblaze B2 bucket instead.
// B2 requires: B2_ENDPOINT, B2_BUCKET, B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY.
const createStorageEnv = (env: any): any => {
  if (env.STORAGE_BACKEND !== 'b2') {
    return env
  }

  if (!env.B2_ENDPOINT || !env.B2_BUCKET || !env.B2_ACCESS_KEY_ID || !env.B2_SECRET_ACCESS_KEY) {
    console.error('[b2-storage] STORAGE_BACKEND=b2 requires B2_ENDPOINT, B2_BUCKET, B2_ACCESS_KEY_ID, B2_SECRET_ACCESS_KEY')
    return env
  }

  const b2 = new B2Storage({
    endpoint: env.B2_ENDPOINT,
    bucket: env.B2_BUCKET,
    accessKeyId: env.B2_ACCESS_KEY_ID,
    secretAccessKey: env.B2_SECRET_ACCESS_KEY,
    region: env.B2_REGION
  })

  return {
    ...env,
    MEDIA_BUCKET: b2
  }
}

// Export Workers module with both fetch and scheduled handlers
export default {
  fetch(request: Request, env: any, ctx: ExecutionContext) {
    return app.fetch(request, createStorageEnv(env), ctx)
  },
  async scheduled(_controller: ScheduledController, env: any, ctx: ExecutionContext) {
    const scheduler = new SchedulerService(env.DB, env, ctx)
    ctx.waitUntil(scheduler.processScheduledContent())
  },
}
