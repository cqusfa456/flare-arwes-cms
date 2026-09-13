/**
 * Put an Astro file into a CMS `pages` entry.
 *
 * `pages` entries can carry an `astro` field holding a whole `.astro` file (the
 * astro-editor plugin edits it). This script uploads such a file to an existing
 * page, or creates the page if it does not exist yet. It is how the front page is
 * authored from the repository (see cms/packages/cms/content/pages/home.astro),
 * and it is a convenient way to publish a page you wrote locally.
 *
 * The stored value is the file's text, verbatim: the website build writes it to a
 * real page file and lets Astro compile it.
 *
 * Usage:
 *   SCIFI_ADMIN_PASSWORD=... node scripts/set-page-astro.mjs <base-url> \
 *     --slug index --title "Futuristic Sci-Fi UI Web Framework" \
 *     --file cms/packages/cms/content/pages/home.astro \
 *     [--layout <key>] [--nav <key>] [--dry-run] [--confirm-production]
 */

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const baseUrl = args.find((a) => !a.startsWith('-'))?.replace(/\/+$/, '')
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const slug = value('slug', '')
const title = value('title', '')
const file = value('file', '')
const layout = value('layout', '')
const nav = value('nav', '')
const dryRun = args.includes('--dry-run')

if (!baseUrl || !slug || !file) {
  console.error(
    'Usage: node scripts/set-page-astro.mjs <base-url> --slug <slug> --title <title> --file <path.astro> [--layout <key>] [--nav <key>] [--dry-run] [--confirm-production]'
  )
  process.exit(1)
}

const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(baseUrl)
if (!isLocalhost && !args.includes('--confirm-production') && !dryRun) {
  console.error(
    `WARNING: this writes to ${baseUrl}. Re-run with --confirm-production (or --dry-run).`
  )
  process.exit(1)
}

const log = (message) => console.log(`  ${message}`)

const run = async () => {
  const source = readFileSync(file, 'utf-8')
  log(`${file}: ${source.length} bytes`)

  const login = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SCIFI_ADMIN_EMAIL ?? 'admin@arwes.dev',
      password: process.env.SCIFI_ADMIN_PASSWORD ?? ''
    })
  })
  if (!login.ok) throw new Error(`Authentication failed (${login.status}): ${await login.text()}`)
  const { token } = await login.json()
  if (!token) throw new Error('Authentication succeeded but no token was returned')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const collections = await (await fetch(`${baseUrl}/api/collections`, { headers })).json()
  const pages = (collections.data ?? []).find((collection) => collection.name === 'pages')
  if (!pages) throw new Error('The CMS has no "pages" collection')

  const existing =
    (await (await fetch(`${baseUrl}/api/collections/pages/content?limit=1000`, { headers })).json())
      .data ?? []
  const match = existing.find((item) => item.slug === slug)

  const payload = {
    collectionId: pages.id,
    title: title || match?.title || slug,
    slug,
    status: 'published',
    // Keep whatever else the entry had (markdown body, meta description, ...): the
    // Astro source is an additional field, not a replacement. `--layout` / `--nav`
    // pick the layout version that frames the page and the menu it renders; both
    // fall back to the site rule when left out.
    data: {
      ...(match?.data ?? {}),
      title: title || match?.title || slug,
      slug,
      astro: source,
      ...(layout ? { layout } : {}),
      ...(nav ? { nav } : {})
    }
  }

  log(match ? `updating page "${slug}" (${match.id})` : `creating page "${slug}"`)
  if (dryRun) {
    log('dry run: nothing was written')
    return
  }

  const res = await fetch(match ? `${baseUrl}/api/content/${match.id}` : `${baseUrl}/api/content`, {
    method: match ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  const body = await res.text()
  log(`${match ? 'PUT' : 'POST'} -> ${res.status}`)
  if (!res.ok) throw new Error(body)
  log('done')
}

run().catch((error) => {
  console.error('Fatal error:', error.message ?? error)
  process.exit(1)
})
