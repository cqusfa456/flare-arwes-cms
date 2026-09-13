/**
 * Materialise the CMS-managed site chrome as real Astro files.
 *
 * A `pages` entry may carry an `astro` field holding a whole `.astro` file (the
 * `astro-editor` plugin provides the editor). This script runs before
 * `astro build`, fetches the published content from the CMS, and writes:
 *
 *   pages       -> src/pages/...            the page itself (the manifest
 *                                           `.cms-pages.json` lists the paths it
 *                                           owns, so the catch-all route skips them)
 *   layouts     -> src/cms-layouts/<key>.astro     a page frame with a <slot />
 *   components  -> src/cms-components/<key>.astro  shared chrome (nav, footer, ...)
 *
 * Every page is injected through the layout it selects (`default` when it names
 * none), and every layout composes the shared components, so the site's style and
 * its menus live in the CMS while a page is content only. Astro compiles all of
 * them like hand-written files: layouts, components, imports and expressions work.
 *
 * Pages with no `astro` field are left alone: they keep rendering through the
 * markdown path in `src/pages/[...path].astro`, which is what entries created
 * before the field existed have — and they too are framed by their layout.
 *
 * Generated files live in `src/pages/`, `src/cms-layouts/` and `src/cms-components/`
 * (all ignored by git).
 *
 * Usage (normally via scripts/setup.sh, before the build):
 *   node scripts/sync-cms-pages.mjs [--verbose]
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { SciFiClient, SciFiD1Client } from '@sci-fi-cms/astro'

const APP_DIR = resolve(import.meta.dirname ?? '.', '..')
const PAGES_DIR = join(APP_DIR, 'src', 'pages')
const LAYOUTS_DIR = join(APP_DIR, 'src', 'cms-layouts')
const COMPONENTS_DIR = join(APP_DIR, 'src', 'cms-components')
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

/**
 * Every page file in the repository this script wrote, recognised by its header
 * (see the bottom of a generated file). Hand-written pages carry no such header and
 * are never returned.
 */
const listGeneratedPageFiles = () => {
  const found = []
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name.endsWith('.astro')) {
        try {
          if (readFileSync(full, 'utf-8').includes('Generated from the CMS page')) {
            found.push(full)
          }
        } catch {
          // An unreadable file is not this script's to remove.
        }
      }
    }
  }
  if (existsSync(PAGES_DIR)) {
    walk(PAGES_DIR)
  }
  return found
}

const run = async () => {
  const client = createClient()

  // A content-only site (a blog subdomain) may not publish pages at all; then no
  // page file is generated. It still gets the shared chrome: its layouts and
  // components frame the collections it does publish.
  const routing = await client.fetchSiteRouting(SITE).catch(() => null)
  const routes = routing?.contentRoutes ?? null
  const publishesPages = !(routes && routes.pages === undefined)
  if (!publishesPages) {
    // A content-only site publishes no pages at all: every file this script wrote
    // on a previous run goes, manifest or not (the manifest of a content-only site
    // is empty, so a file another site generated would otherwise linger and be
    // built here).
    for (const path of cleanPrevious()) {
      rmSync(fileForPath(path), { force: true })
    }
    for (const file of listGeneratedPageFiles()) {
      rmSync(file, { force: true })
      log(`removed ${file.replace(APP_DIR, '.')} (this site publishes no pages)`)
    }
    writeFileSync(MANIFEST, JSON.stringify({ generated: [] }, null, 2) + '\n')
    log(`"${routing.slug}" does not publish pages; generating its chrome only`)
  }

  const collections = await client.fetchCollections()
  const pagesCollection = collections.find((collection) => collection.name === 'pages')
  if (!pagesCollection) {
    log('the CMS has no "pages" collection; generating the shared chrome only')
    writeFileSync(MANIFEST, JSON.stringify({ generated: [] }, null, 2) + '\n')
  }

  const items =
    publishesPages && pagesCollection
      ? (await client.fetchCollection('pages')).filter((item) => item.status === 'published')
      : []

  // Page frames live in the CMS too: every page is injected through the layout it
  // selects (`default` when it names none), and each layout composes the shared
  // components. Both are written next to the pages as real Astro files, so a layout
  // can import whatever the CMS publishes under `components`.
  const layoutEntries = await client.fetchCollection('layouts').catch(() => [])
  const componentEntries = await client.fetchCollection('components').catch(() => [])

  const sourcesFrom = (entries) => {
    const sources = new Map()
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = String(entry.data?.key ?? entry.slug ?? '')
      const astro = entry.data?.astro
      if (key && typeof astro === 'string' && astro.trim() !== '') {
        sources.set(key, astro.replace(/\s*$/, ''))
      }
    }
    return sources
  }

  const layoutsByKey = sourcesFrom(layoutEntries)
  const componentsByKey = sourcesFrom(componentEntries)

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
    // A file this script wrote before (its header says so) may be replaced even if
    // the manifest was lost; a hand-written page file never is.
    const isGeneratedFile =
      existsSync(file) && readFileSync(file, 'utf-8').includes('Generated from the CMS page')
    if (existsSync(file) && !previouslyGenerated.has(path) && !isGeneratedFile) {
      console.warn(
        `  [pages] "${path}" is served by a page file already in the repository; the CMS page was not written`
      )
      blocked++
      continue
    }

    mkdirSync(dirname(file), { recursive: true })

    // The author decides the shape:
    //   * a source that renders its own `<Layout>` is the whole page: compiled as-is;
    //   * anything else is content: the author's frontmatter (imports, variables) is
    //     kept and the body is wrapped in the shared `Layout`, which injects the
    //     layout version the page selects. So a page is content only, and its frame
    //     is managed in the CMS.
    let contents = source

    if (!/<Layout[\s>]/.test(source)) {
      const pageTitle = String(item.title ?? '')
      const navKey = typeof item.data?.nav === 'string' && item.data.nav ? item.data.nav : null
      const layoutKey =
        typeof item.data?.layout === 'string' && item.data.layout ? item.data.layout : null
      const navAttr = navKey ? ` navKey=${JSON.stringify(navKey)}` : ''
      const layoutAttr = layoutKey ? ` layout=${JSON.stringify(layoutKey)}` : ''

      // Split the author's frontmatter off, if any.
      const frontmatterMatch = source.match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
      const authorFrontmatter = frontmatterMatch ? frontmatterMatch[1].trim() : ''
      const body = (frontmatterMatch ? source.slice(frontmatterMatch[0].length) : source).replace(
        /\s*$/,
        ''
      )

      const imports = [
        "import Layout from '@/layouts/Layout.astro'",
        "import { settings } from '@/config/settings'"
      ]

      contents = [
        '---',
        ...imports,
        ...(authorFrontmatter ? ['', authorFrontmatter] : []),
        '',
        `const title = ${JSON.stringify(pageTitle)}`,
        `const pathname = ${JSON.stringify(path)}`,
        '---',
        '',
        `<Layout title={\`\${title} | \${settings.title}\`} pageTitle={title} pathname={pathname}${navAttr}${layoutAttr} hasServerContent>`,
        body,
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

  // Write every layout and every shared component, not only the ones the pages
  // above happen to use: a page selects a layout version by key at build time, and
  // a layout composes components by key, so all of them have to be importable.
  const writeSources = (directory, sources, kind, help) => {
    const keys = [...sources.keys()]
    for (const key of keys) {
      const file = join(directory, `${key}.astro`)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(
        file,
        `${sources.get(key)}\n<!-- Generated from the CMS ${kind} "${key}". Edit it in Admin → Content → ${help}. -->\n`
      )
    }
    if (keys.length) {
      log(`${kind} file(s): ${keys.join(', ')}`)
    }
    return keys
  }

  writeSources(LAYOUTS_DIR, layoutsByKey, 'layout', 'Layouts')
  writeSources(COMPONENTS_DIR, componentsByKey, 'component', 'Components')

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
