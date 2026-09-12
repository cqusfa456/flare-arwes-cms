/**
 * API System Routes
 *
 * Provides system health, status, and metadata endpoints
 * These are lightweight routes without heavy dependencies
 */

import { Hono } from 'hono'
import type { Bindings, Variables } from '../app'
import { getStorageInfo, STORAGE_HEALTH_CHECK_KEY } from '../storage'

export const apiSystemRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/**
 * System health check
 * GET /api/system/health
 */
apiSystemRoutes.get('/health', async (c) => {
  try {
    const startTime = Date.now()

    // Check database connectivity
    let dbStatus = 'unknown'
    let dbLatency = 0

    try {
      const dbStart = Date.now()
      await c.env.DB.prepare('SELECT 1').first()
      dbLatency = Date.now() - dbStart
      dbStatus = 'healthy'
    } catch (error) {
      console.error('Database health check failed:', error)
      dbStatus = 'unhealthy'
    }

    // Check KV connectivity (if available)
    let kvStatus = 'not_configured'
    let kvLatency = 0

    if (c.env.CACHE_KV) {
      try {
        const kvStart = Date.now()
        await c.env.CACHE_KV.get('__health_check__')
        kvLatency = Date.now() - kvStart
        kvStatus = 'healthy'
      } catch (error) {
        console.error('KV health check failed:', error)
        kvStatus = 'unhealthy'
      }
    }

    // Check storage connectivity for whichever backend is active
    // (Cloudflare R2 binding or an S3-compatible endpoint such as Backblaze B2).
    const storageInfo = getStorageInfo(c.env)
    const storageBucket = c.env.MEDIA_BUCKET
    let storageStatus = 'not_configured'
    let storageLatency = 0

    if (storageInfo.configured && storageBucket && typeof storageBucket.head === 'function') {
      try {
        const storageStart = Date.now()
        // A missing key returns null rather than throwing, so a successful
        // round-trip proves endpoint + bucket + credentials are all valid.
        await storageBucket.head(STORAGE_HEALTH_CHECK_KEY)
        storageLatency = Date.now() - storageStart
        storageStatus = 'healthy'
      } catch (error) {
        console.error(`Storage health check failed (${storageInfo.provider}):`, error)
        storageStatus = 'unhealthy'
      }
    } else if (storageInfo.configured) {
      storageStatus = 'misconfigured'
    }

    const totalLatency = Date.now() - startTime
    const storageFailing = storageStatus === 'unhealthy' || storageStatus === 'misconfigured'
    const overall = dbStatus === 'healthy' && !storageFailing ? 'healthy' : 'degraded'

    return c.json({
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: totalLatency,
      checks: {
        database: {
          status: dbStatus,
          latency: dbLatency
        },
        cache: {
          status: kvStatus,
          latency: kvLatency
        },
        storage: {
          status: storageStatus,
          provider: storageInfo.provider,
          providerLabel: storageInfo.providerLabel,
          latency: storageLatency,
          ...(storageInfo.error ? { error: storageInfo.error } : {})
        }
      },
      environment: c.env.ENVIRONMENT || 'production'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    }, 503)
  }
})

/**
 * System information
 * GET /api/system/info
 */
apiSystemRoutes.get('/info', (c) => {
  const appVersion = c.get('appVersion') || '1.0.0'
  const storageInfo = getStorageInfo(c.env)

  return c.json({
    name: 'Sci-Fi CMS',
    version: appVersion,
    description: 'Modern headless CMS built on Cloudflare Workers',
    endpoints: {
      api: '/api',
      auth: '/auth',
      health: '/api/system/health',
      docs: '/docs'
    },
    features: {
      content: true,
      media: true,
      auth: true,
      collections: true,
      caching: !!c.env.CACHE_KV,
      storage: storageInfo.configured,
      storageProvider: storageInfo.provider
    },
    storage: {
      provider: storageInfo.provider,
      providerLabel: storageInfo.providerLabel,
      bucketName: storageInfo.bucketName,
      endpointHost: storageInfo.endpointHost,
      region: storageInfo.region
    },
    timestamp: new Date().toISOString()
  })
})

/**
 * System stats
 * GET /api/system/stats
 */
apiSystemRoutes.get('/stats', async (c) => {
  try {
    const db = c.env.DB

    // Get content statistics
    const contentStats = await db.prepare(`
      SELECT COUNT(*) as total_content
      FROM content
      WHERE deleted_at IS NULL
    `).first() as any

    // Get media statistics
    const mediaStats = await db.prepare(`
      SELECT
        COUNT(*) as total_files,
        SUM(size) as total_size
      FROM media
      WHERE deleted_at IS NULL
    `).first() as any

    // Get user statistics
    const userStats = await db.prepare(`
      SELECT COUNT(*) as total_users
      FROM users
    `).first() as any

    return c.json({
      content: {
        total: contentStats?.total_content || 0
      },
      media: {
        total_files: mediaStats?.total_files || 0,
        total_size_bytes: mediaStats?.total_size || 0,
        total_size_mb: Math.round((mediaStats?.total_size || 0) / 1024 / 1024 * 100) / 100
      },
      users: {
        total: userStats?.total_users || 0
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Stats query failed:', error)
    return c.json({ error: 'Failed to fetch system statistics' }, 500)
  }
})

/**
 * Database ping
 * GET /api/system/ping
 */
apiSystemRoutes.get('/ping', async (c) => {
  try {
    const start = Date.now()
    await c.env.DB.prepare('SELECT 1').first()
    const latency = Date.now() - start

    return c.json({
      pong: true,
      latency,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Ping failed:', error)
    return c.json({
      pong: false,
      error: 'Database connection failed'
    }, 503)
  }
})

/**
 * Environment check
 * GET /api/system/env
 */
apiSystemRoutes.get('/env', (c) => {
  const storageInfo = getStorageInfo(c.env)

  return c.json({
    environment: c.env.ENVIRONMENT || 'production',
    features: {
      database: !!c.env.DB,
      cache: !!c.env.CACHE_KV,
      media_bucket: !!c.env.MEDIA_BUCKET,
      storage_provider: storageInfo.provider,
      email_queue: !!c.env.EMAIL_QUEUE,
      sendgrid: !!c.env.SENDGRID_API_KEY,
      cloudflare_images: !!(c.env.IMAGES_ACCOUNT_ID && c.env.IMAGES_API_TOKEN)
    },
    timestamp: new Date().toISOString()
  })
})

export default apiSystemRoutes
