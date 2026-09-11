import { defineCollection } from 'astro:content'
import { flareLoader } from '@flare-cms/astro'

// Flare CMS API URL. In local development it points to the local
// wrangler dev server. In production it points to the deployed
// Cloudflare Worker.
const API_URL = import.meta.env.PUBLIC_FLARE_API_URL || 'http://localhost:8787'
const API_TOKEN = import.meta.env.PUBLIC_FLARE_API_TOKEN

// Site this build belongs to (a slug registered in Flare CMS → Admin → Sites).
// It is sent as `X-Site` so the CMS returns this site's content plus shared
// content. Leave it unset for a single-tenant deployment: once any site is
// registered, an unidentified build only sees shared content.
const SITE = import.meta.env.PUBLIC_FLARE_SITE

// Pages collection — content managed in Flare CMS admin.
// Each page has a slug (URL path), title, and markdown content.
const pages = defineCollection({
  loader: flareLoader({
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    site: SITE,
    collection: 'pages',
    filter: { status: 'published' }
  })
})

export const collections = { pages }
