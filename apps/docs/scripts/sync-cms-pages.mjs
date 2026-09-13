/**
 * Materialise CMS pages as real Astro files.
 *
 * A `pages` entry may carry an `astro` field holding a whole `.astro` file (the
 * `astro-editor` plugin provides the editor). This script runs before
 * `astro build`, fetches the published pages from the CMS, and writes each one to
 * the path its collection prefix and slug resolve to, so Astro compiles it like
 * any hand-written page: layouts, components, imports and expressions all work.
 *
 * Pages with no `astro` field are left alone: they keep rendering through the
 * markdown path in `src/pages/[...path].astro`, which is what entries created
 * before the field existed have.
 *
 * The generated files live in `src/pages/` (ignored by git) and the list of paths
 * they own is written to `.cms-pages.json`, which that route reads so the two
 * never claim the same path.
 *
 * Usage (normally via scripts/setup.sh, before the build):
 *   node scripts/sync-cms-pages.mjs [--verbose]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { SciFiClient, SciFiD1Client } from '@sci-fi-cms/astro'

const APP_DIR = resolve(import.meta.dirname ?? '.', '..')
const PAGES_DIR = join(APP_DIR, 'src', 'pages')
const MANIFEST = join(APP_DIR, '.cms-pages.json')

const verbose = process.argv.includes('--verbose')
const log = (message) => console.log(`  [pages] ${message}`)

// The same source configuration the Content Layer loader uses (see
// src/lib/cms-source.ts): D1 credentials when the build machine has them, the CMS
// HTTP API otherwise.
const API_URL =
  process.env.PUBLIC_SCIFI_API_URL || process.env.PUBLIC_FLARE_API_URL || 'http://localhost:8787'
const API_TOKEN = process.env.PUBLIC_SCIFI_API_TOKEN || process.env.PUBLIC_FLARE_API_TOKEN
const SITE = process.env.PUBLIC_SCIFI_SITE || process.env.PUBLIC_FLARE_SITE

const D1 =
  process.env.SCIFI_D1_ACCOUNT_ID && process.env.SCIFI_D1_API_TOKEN
    ? {
        accountId: process.env.SCIFI_D1_ACCOUNT_ID,
        databaseId: process.env.SCIFI_D1_DATABASE_ID || undefined,
        databaseName: process.env.SCIFI_D1_DATABASE_NAME || undefined,
        apiToken: process.env.SCIFI_D1_API_TOKEN
      }
    : undefined

const createClient = () =>
  D1
    ? new SciFiD1Client(D1, SITE)
    : new SciFiClient({ apiUrl: API_URL, apiToken: API_TOKEN, site: SITE })

/** Path of a `pages` entry, mirroring src/lib/cms-collections.ts. */
const pagePath = (slug, prefix) => {
  if (prefix === null || prefix === undefined) {
    return null
  }
  const base = String(prefix).replace(/\/+$/, '')
  const clean = String(slug ?? '').replace(/^\/+|\/+$/g, '')
  if (clean === 'index' || clean === 'home') {
    return base === '' ? '/' : base
  }
  return `${base}/${clean}`
}

/** File a path is written to, inside src/pages. */
const fileForPath = (path) => {
  const clean = path.replace(/^\/+|\/+$/g, '')
  return clean === '' ? join(PAGES_DIR, 'index.astro') : join(PAGES_DIR, `${clean}.astro`)
}

/** Remove the files a previous run generated. */
const cleanPrevious = () => {
  if (!existsSync(MANIFEST)) {
    return []
  }
  try {
    const previous = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
    return Array.isArray(previous.generated) ? previous.generated : []
  } catch {
    return []
  }
}

const run = async () => {
  const client = createClient()

  // A content-only site (a blog subdomain) may not publish pages at all; then
  // there is nothing to generate and the manifest has to say so.
  const routing = await client.fetchSiteRouting(SITE).catch(() => null)
  const routes = routing?.contentRoutes ?? null
  if (routes && routes.pages === undefined) {
    for (const path of cleanPrevious()) {
      rmSync(fileForPath(path), { force: true })
    }
    writeFileSync(MANIFEST, JSON.stringify({ generated: [] }, null, 2) + '\n')
    log(`"${routing.slug}" does not publish pages; nothing generated`)
    return
  }

  const collections = await client.fetchCollections()
  const pagesCollection = collections.find((collection) => collection.name === 'pages')
  if (!pagesCollection) {
    log('the CMS has no "pages" collection; nothing generated')
    writeFileSync(MANIFEST, JSON.stringify({ generated: [] }, null, 2) + '\n')
    return
  }

  const items = (await client.fetchCollection('pages')).filter(
    (item) => item.status === 'published'
  )

  // Page frames live in the CMS too: a page is wrapped in the layout it selects
  // (`default` when it names none), so an author writes content only.
  const layoutEntries = await client.fetchCollection('layouts').catch(() => [])
  const layoutsByKey = new Map()
  for (const entry of layoutEntries) {
    const key = String(entry.data?.key ?? entry.slug ?? '')
    const astro = entry.data?.astro
    if (key && typeof astro === 'string' && astro.trim() !== '') {
      layoutsByKey.set(key, astro.replace(/\s*$/, ''))
    }
  }
  const usedLayouts = new Set()
  const layoutSourceFor = (page) => {
    const wanted = [page.data?.layout, 'default'].filter((key) => typeof key === 'string' && key)
    for (const key of wanted) {
      const layoutSource = layoutsByKey.get(key)
      if (layoutSource) {
        usedLayouts.add(key)
        return { key, source: layoutSource }
      }
    }
    return null
  }

  const generated = []
  // Paths a previous run wrote, so a hand-written page file is never overwritten.
  const previouslyGenerated = new Set(cleanPrevious())
  let written = 0
  let skipped = 0
  let blocked = 0

  for (const item of items) {
    const source = item.data?.astro
    if (typeof source !== 'string' || source.trim() === '') {
      skipped++
      continue
    }

    const path = pagePath(item.data?.slug ?? item.slug, pagesCollection.urlPrefix)
    if (!path) {
      skipped++
      continue
    }

    const file = fileForPath(path)
    if (existsSync(file) && !previouslyGenerated.has(path)) {
      console.warn(
        `  [pages] "${path}" is served by a page file already in the repository; the CMS page was not written`
      )
      blocked++
      continue
    }

    mkdirSync(dirname(file), { recursive: true })

    // The author decides the shape:
    //   * a file that starts with `---` is the whole page and is compiled as-is;
    //   * anything else is the page's markup, wrapped in the page frame the CMS
    //     provides (`default` unless the page names another) so the site's style
    //     stays consistent and the author writes content only. A layout may render
    //     `<slot />` and receives `title` and `pathname` as props.
    const trimmed = source.replace(/^\s+/, '')
    let contents = source

    if (!trimmed.startsWith('---')) {
      const pageTitle = String(item.title ?? '')
      const navKey = typeof item.data?.nav === 'string' && item.data.nav ? item.data.nav : null
      const layout = layoutSourceFor(item)
      const navAttr = navKey ? ` navKey=${JSON.stringify(navKey)}` : ''

      const imports = ["import Layout from '@/layouts/Layout.astro'"]
      if (layout) {
        imports.push(`import PageLayout from '@/cms-layouts/${layout.key}.astro'`)
      }
      imports.push("import { settings } from '@/config/settings'")

      const body = source.replace(/\s*$/, '')
      const wrapped = layout
        ? `  <PageLayout title={title} pathname={pathname}>\n${body}\n  </PageLayout>`
        : body

      contents = [
        '---',
        ...imports,
        '',
        `const title = ${JSON.stringify(pageTitle)}`,
        `const pathname = ${JSON.stringify(path)}`,
        '---',
        '',
        `<Layout title={\`\${title} | \${settings.title}\`} pathname={pathname}${navAttr}>`,
        wrapped,
        '</Layout>',
        ''
      ].join('\n')
    }

    const header = `<!-- Generated from the CMS page "${item.slug}". Edit it in Admin → Content → Pages. -->\n`
    writeFileSync(file, `${contents.replace(/\s*$/, '')}\n${header}`)
    generated.push(path)
    written++
    if (verbose) {
      log(`${path} -> ${file.replace(APP_DIR, '.')}`)
    }
  }

  // Write the layouts the generated pages import.
  const layoutFiles = []
  for (const key of usedLayouts) {
    const file = join(LAYOUTS_DIR, `${key}.astro`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(
      file,
      `${layoutsByKey.get(key)}\n<!-- Generated from the CMS layout "${key}". Edit it in Admin → Content → Layouts. -->\n`
    )
    layoutFiles.push(key)
  }
  if (layoutFiles.length) {
    log(`layout file(s): ${layoutFiles.join(', ')}`)
  }

  // Drop files a previous run wrote that no longer exist in the CMS.
  const stale = [...previouslyGenerated].filter((path) => !generated.includes(path))
  for (const path of stale) {
    rmSync(fileForPath(path), { force: true })
    log(`removed ${path} (no longer published)`)
  }

  writeFileSync(MANIFEST, JSON.stringify({ generated }, null, 2) + '\n')
  log(
    `${written} page file(s) generated` +
      `${skipped ? `, ${skipped} without an "astro" field (rendered as markdown)` : ''}` +
      `${blocked ? `, ${blocked} skipped because the repository owns that path` : ''}`
  )
}

run().catch((error) => {
  // A failure here must not publish a site with stale or missing pages silently:
  // fail the build instead.
  console.error(`  [pages] failed: ${error?.message ?? error}`)
  process.exit(1)
})
