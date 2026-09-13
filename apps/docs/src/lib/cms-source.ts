/**
 * Where the build reads its content and routing from.
 *
 * One module so the Content Layer loader (content.config.ts) and the build-time
 * routing helper (cms-collections.ts) cannot drift apart.
 */
import type { SciFiD1Options } from '@sci-fi-cms/astro'

const env = import.meta.env as Record<string, string | undefined>

/**
 * CMS API URL. `PUBLIC_FLARE_*` are pre-rename aliases, still read so a trigger
 * that has not been re-synced keeps resolving the CMS instead of falling back to
 * localhost.
 */
export const API_URL =
  env.PUBLIC_SCIFI_API_URL || env.PUBLIC_FLARE_API_URL || 'http://localhost:8787'
export const API_TOKEN = env.PUBLIC_SCIFI_API_TOKEN || env.PUBLIC_FLARE_API_TOKEN

/**
 * Site this build belongs to (a slug registered in Sci-Fi CMS → Admin → Sites).
 * It scopes the content to this site plus shared content. Unset is only correct
 * for a single-tenant deployment.
 */
export const SITE = env.PUBLIC_SCIFI_SITE || env.PUBLIC_FLARE_SITE

/**
 * D1 source. CI sets these (the deploy workflow passes the resolved Cloudflare
 * credential, which has D1 access), so a deployed build reads the database
 * directly: it does not depend on the Worker being reachable and it cannot be
 * served a cached response. Local development leaves them unset and falls back
 * to the HTTP API.
 *
 * Read from `process.env`, not `import.meta.env`: only PUBLIC_-prefixed values
 * are exposed there, and this token must never reach a client bundle.
 */
export const D1: SciFiD1Options | undefined =
  process.env.SCIFI_D1_ACCOUNT_ID && process.env.SCIFI_D1_API_TOKEN
    ? {
        accountId: process.env.SCIFI_D1_ACCOUNT_ID,
        databaseId: process.env.SCIFI_D1_DATABASE_ID || undefined,
        databaseName: process.env.SCIFI_D1_DATABASE_NAME || undefined,
        apiToken: process.env.SCIFI_D1_API_TOKEN
      }
    : undefined

if (!D1) {
  console.warn(
    '[content] No D1 credentials (SCIFI_D1_ACCOUNT_ID / SCIFI_D1_API_TOKEN); ' +
      `reading content from the CMS API at ${API_URL} instead.`
  )
}
