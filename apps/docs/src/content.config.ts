import { defineCollection } from 'astro:content'
import { sciFiLoader } from '@sci-fi-cms/astro'

import { API_TOKEN, API_URL, D1, SITE } from './lib/cms-source'

// Every collection reads from the CMS at build time. Where each one's entries
// are published is a CMS setting (`url_prefix`, Admin → Collections) read in
// src/lib/cms-collections.ts — not hardcoded here.
const source = {
  d1: D1,
  apiUrl: API_URL,
  apiToken: API_TOKEN,
  site: SITE
}

// Blog posts — rendered under the `blog-posts` collection's URL prefix.
const posts = defineCollection({
  loader: sciFiLoader({
    ...source,
    collection: 'blog-posts',
    filter: { status: 'published' }
  })
})

// Standalone pages — normally published at the site root.
const pages = defineCollection({
  loader: sciFiLoader({
    ...source,
    collection: 'pages',
    filter: { status: 'published' }
  })
})

// Documentation. `docs` items carry title/slug/excerpt/order plus markdown
// content and are rendered under the `docs` collection's URL prefix;
// `docs-sections` carries the section metadata (name/slug/order/description) and
// feeds the sidebar.
const docs = defineCollection({
  loader: sciFiLoader({
    ...source,
    collection: 'docs',
    filter: { status: 'published' }
  })
})

const docsSections = defineCollection({
  loader: sciFiLoader({
    ...source,
    collection: 'docs-sections'
  })
})

// Menus and page frames, both managed in the CMS. Neither publishes a path of its
// own: they configure how pages look (see src/lib/site-content.ts).
const navigation = defineCollection({
  loader: sciFiLoader({
    ...source,
    collection: 'navigation'
  })
})

const layouts = defineCollection({
  loader: sciFiLoader({
    ...source,
    collection: 'layouts'
  })
})

export const collections = { posts, pages, docs, docsSections, navigation, layouts }
