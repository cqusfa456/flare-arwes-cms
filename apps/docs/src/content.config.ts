import { defineCollection } from 'astro:content'
import { sciFiLoader, type SciFiD1Options } from '@sci-fi-cms/astro'

// Sci-Fi CMS API URL. In local development it points to the local
// wrangler dev server. In production it points to the deployed
// Cloudflare Worker.
// The PUBLIC_FLARE_* spellings are pre-rename aliases. They are still read so a
// build running against a Workers Builds trigger that has not been re-synced yet
// keeps resolving the CMS instead of silently falling back to localhost. Drop
// them once every trigger carries the PUBLIC_SCIFI_* names.
const env = import.meta.env as Record<string, string | undefined>
const API_URL = env.PUBLIC_SCIFI_API_URL || env.PUBLIC_FLARE_API_URL || 'http://localhost:8787'
const API_TOKEN = env.PUBLIC_SCIFI_API_TOKEN || env.PUBLIC_FLARE_API_TOKEN

// Site this build belongs to (a slug registered in Sci-Fi CMS → Admin → Sites).
// It is sent as `X-Site` so the CMS returns this site's content plus shared
// content. Leave it unset for a single-tenant deployment: once any site is
// registered, an unidentified build only sees shared content.
const SITE = env.PUBLIC_SCIFI_SITE || env.PUBLIC_FLARE_SITE

// D1 source. CI sets these (the deploy workflow passes the resolved Cloudflare
// credential, which has D1 access), so a deployed build reads the database
// directly: it does not depend on the Worker being reachable and it cannot be
// served a cached response. Local development leaves them unset and falls back
// to the HTTP API above.
//
// Read from `process.env`, not `import.meta.env`: only PUBLIC_-prefixed values
// are exposed there, and this token must never reach a client bundle.
const D1: SciFiD1Options | undefined =
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

// Pages collection — content managed in Sci-Fi CMS admin.
// Each page has a slug (URL path), title, and markdown content.
const pages = defineCollection({
  loader: sciFiLoader({
    d1: D1,
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    site: SITE,
    collection: 'pages',
    filter: { status: 'published' }
  })
})

// Documentation managed in the CMS (Admin → Content → docs / docs-sections).
// `docs` items carry title/slug/excerpt/order plus markdown content and are
// rendered under /docs/<slug>; `docs-sections` carries the section metadata
// (name/slug/order/description) and is available for navigation.
const docs = defineCollection({
  loader: sciFiLoader({
    d1: D1,
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    site: SITE,
    collection: 'docs',
    filter: { status: 'published' }
  })
})

const docsSections = defineCollection({
  loader: sciFiLoader({
    d1: D1,
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    site: SITE,
    collection: 'docs-sections'
  })
})

export const collections = { pages, docs, docsSections }
