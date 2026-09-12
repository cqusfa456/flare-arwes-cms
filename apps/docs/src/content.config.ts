import { defineCollection } from 'astro:content'
import { sciFiLoader } from '@sci-fi-cms/astro'

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

// Pages collection — content managed in Sci-Fi CMS admin.
// Each page has a slug (URL path), title, and markdown content.
const pages = defineCollection({
  loader: sciFiLoader({
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
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    site: SITE,
    collection: 'docs',
    filter: { status: 'published' }
  })
})

const docsSections = defineCollection({
  loader: sciFiLoader({
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    site: SITE,
    collection: 'docs-sections'
  })
})

export const collections = { pages, docs, docsSections }
