import type { Context } from 'hono'
import type { Bindings } from '@flare-cms/core'
import { getStorageInfo } from '@flare-cms/core'

const JWT_SECRET_HARDCODED_DEFAULT = 'your-super-secret-jwt-key-change-in-production'

type MiddlewareFn = (c: Context, next: () => Promise<void>) => Promise<Response | undefined>

export function validateBindingsMiddleware(): MiddlewareFn {
  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    const missing: string[] = []

    if (!c.env.DB) missing.push('DB (D1 database)')

    if (missing.length > 0) {
      console.error('[Startup] Missing required bindings:', missing.join(', '))
      return c.json(
        { error: 'Service unavailable: infrastructure misconfiguration' },
        500
      )
    }

    // Storage backend assertion — the provider is chosen by environment
    // configuration, so report exactly which backend was selected and what it
    // is missing instead of assuming R2.
    const storageInfo = getStorageInfo(c.env)
    if (!storageInfo.configured) {
      const detail =
        storageInfo.error ||
        `MEDIA_BUCKET (${storageInfo.providerLabel}) is not available`
      console.error(`[Startup] Storage backend "${storageInfo.provider}" is not configured: ${detail}`)
      return c.json(
        {
          error: 'Service unavailable: storage backend misconfigured',
          storage: {
            provider: storageInfo.provider,
            providerLabel: storageInfo.providerLabel,
            missing: storageInfo.missingVars,
            detail
          }
        },
        500
      )
    }

    // JWT_SECRET assertion — block all requests if using hardcoded default
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jwtSecret = (c.env as any).JWT_SECRET
    if (!jwtSecret || jwtSecret === JWT_SECRET_HARDCODED_DEFAULT) {
      console.error('[Startup] FATAL: JWT_SECRET is not set or is using the hardcoded default. Run: wrangler secret put JWT_SECRET')
      return c.json({
        error: 'Service unavailable: JWT_SECRET must be configured — see wrangler secret put JWT_SECRET'
      }, 500)
    }

    // KV is optional — warn only, don't block
    if (!(c.env as any).CACHE_KV) {
      console.warn('[Startup] CACHE_KV binding not configured — rate limiting disabled')
    }

    // Returning undefined (rather than the promise from next()) keeps the
    // declared `Promise<Response | undefined>` contract: every other path in
    // this middleware returns a Response so it can short-circuit the request.
    await next()
    return undefined
  }
}
