/**
 * One-off content restructure for this deployment.
 *
 * Why: blog posts were created in the built-in `pages` collection and published
 * under /blog by the site's own code, which left the CMS looking wrong — Admin →
 * Content listed an empty `Blog Posts` collection while the posts were hidden
 * inside `Pages`. Now that every collection records the path its entries are
 * published under (`collections.url_prefix`), the posts belong in `Blog Posts`
 * and `Pages` is free for standalone pages.
 *
 * It is idempotent: entries already present in the target collection are left
 * alone, and an entry is only removed from the source after it exists in the
 * target, so a failed run loses nothing and can simply be repeated.
 *
 * Usage:
 *   node scripts/migrate-blog-collection.mjs <base-url> [--dry-run] [--confirm-production]
 *
 *   SCIFI_ADMIN_PASSWORD=... node scripts/migrate-blog-collection.mjs \
 *     https://sci-fi-cms.cqusfa.workers.dev --confirm-production
 */

const args = process.argv.slice(2)
const baseUrl = args.find((a) => !a.startsWith('-'))?.replace(/\/+$/, '')
const dryRun = args.includes('--dry-run')

if (!baseUrl) {
  console.error(
    'Usage: node scripts/migrate-blog-collection.mjs <base-url> [--dry-run] [--confirm-production]'
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

const SOURCE_COLLECTION = 'pages'
const TARGET_COLLECTION = 'blog-posts'

/** Collection name -> URL prefix. `''` publishes at the site root, null = not routed. */
const PREFIXES = {
  'blog-posts': '/blog',
  pages: '',
  docs: '/docs',
  'docs-sections': null
}

/** Unused default collections, hidden so the admin only shows what this site uses. */
const DEACTIVATE = ['news']

const log = (message) => console.log(`  ${message}`)
const step = (message) => console.log(`\n=> ${message}`)

const login = async () => {
  step(`Authenticating as ${process.env.SCIFI_ADMIN_EMAIL ?? 'admin@arwes.dev'}`)
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SCIFI_ADMIN_EMAIL ?? 'admin@arwes.dev',
      password: process.env.SCIFI_ADMIN_PASSWORD ?? ''
    })
  })
  if (!res.ok) throw new Error(`Authentication failed (${res.status}): ${await res.text()}`)
  const json = await res.json()
  if (!json.token) throw new Error('Authentication succeeded but no token was returned')
  log('Authenticated')
  return json.token
}

const createClient = (token) => {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const request = async (method, path, body) => {
    if (dryRun && method !== 'GET') {
      log(`[dry-run] ${method} ${path}`)
      return {}
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`)
    return res.json().catch(() => ({}))
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    delete: (path) => request('DELETE', path)
  }
}

const run = async () => {
  const client = createClient(await login())

  const collections = new Map(
    ((await client.get('/api/collections')).data ?? []).map((row) => [row.name, row])
  )
  const source = collections.get(SOURCE_COLLECTION)
  const target = collections.get(TARGET_COLLECTION)
  if (!source) throw new Error(`Collection "${SOURCE_COLLECTION}" not found`)
  if (!target) throw new Error(`Collection "${TARGET_COLLECTION}" not found`)

  step(`Moving content from "${SOURCE_COLLECTION}" to "${TARGET_COLLECTION}"`)
  const sourceItems =
    (await client.get(`/api/collections/${SOURCE_COLLECTION}/content?limit=1000`)).data ?? []
  const targetItems =
    (await client.get(`/api/collections/${TARGET_COLLECTION}/content?limit=1000`)).data ?? []
  const targetIdBySlug = new Map(targetItems.map((item) => [item.slug, item.id]))

  let copied = 0
  let replaced = 0

  for (const item of sourceItems) {
    const payload = {
      collectionId: target.id,
      title: item.title,
      slug: item.slug,
      status: item.status,
      data: item.data
    }

    // Publish into the target first: the entry is only removed from the source
    // once it exists there, so a failure in between cannot lose it.
    const existingId = targetIdBySlug.get(item.slug)
    if (existingId) {
      await client.put(`/api/content/${existingId}`, payload)
      replaced++
      log(`Updated in ${TARGET_COLLECTION}: ${item.slug}`)
    } else {
      await client.post('/api/content', payload)
      copied++
      log(`Copied to ${TARGET_COLLECTION}: ${item.slug}`)
    }

    await client.delete(`/api/content/${item.id}`)
    log(`Removed from ${SOURCE_COLLECTION}: ${item.slug}`)
  }

  step('Recording where each collection is published')
  for (const [name, prefix] of Object.entries(PREFIXES)) {
    const collection = collections.get(name)
    if (!collection) {
      log(`Skipped ${name} (not found)`)
      continue
    }
    if (collection.url_prefix === prefix) {
      log(`${name}: already ${prefix === null ? 'not routed' : `"${prefix}"`}`)
      continue
    }
    await client.patch(`/admin/api/collections/${collection.id}`, { url_prefix: prefix })
    log(`${name}: ${prefix === null ? 'not routed' : `"${prefix}"`}`)
  }

  step('Hiding unused collections')
  for (const name of DEACTIVATE) {
    const collection = collections.get(name)
    if (!collection) continue
    await client.patch(`/admin/api/collections/${collection.id}`, { is_active: false })
    log(`${name}: deactivated`)
  }

  step('Summary')
  log(`Copied: ${copied}`)
  log(`Updated in place: ${replaced}`)
  log(dryRun ? 'Dry run: nothing was written' : 'Done')
}

run().catch((error) => {
  console.error('Fatal error:', error.message ?? error)
  process.exit(1)
})
