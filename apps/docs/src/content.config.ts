import { defineCollection } from 'astro:content'
import { flareLoader } from '@flare-cms/astro'

// Flare CMS API URL. In local development it points to the local
// wrangler dev server. In production it points to the deployed
// Cloudflare Worker.
const API_URL = import.meta.env.PUBLIC_FLARE_API_URL || 'http://localhost:8787'
const API_TOKEN = import.meta.env.PUBLIC_FLARE_API_TOKEN

// Pages collection — content managed in Flare CMS admin.
// Each page has a slug (URL path), title, and markdown content.
const pages = defineCollection({
  loader: flareLoader({
    apiUrl: API_URL,
    apiToken: API_TOKEN,
    collection: 'pages',
    filter: { status: 'published' }
  })
})

export const collections = { pages }
