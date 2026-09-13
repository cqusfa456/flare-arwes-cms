import matter from 'gray-matter'
import { glob } from 'glob'
import { readFileSync } from 'fs'
import { basename, resolve } from 'path'

/**
 * Seed script for blog content (the CMS `pages` collection).
 *
 * Reads markdown files from content/blog/ and upserts them into the built-in
 * `pages` collection, which the docs app renders as posts at /blog/<slug>.
 *
 * Unlike the docs seeder this never wipes anything: it matches on slug and
 * updates the entry it finds, so pages created by hand in the admin survive.
 *
 * Usage:
 *   npx tsx scripts/seed-blog.ts http://localhost:8787
 *   npx tsx scripts/seed-blog.ts https://sci-fi-cms.your-subdomain.workers.dev --confirm-production
 */

const CONTENT_DIR = resolve(import.meta.dirname ?? '.', '..', 'content', 'blog')
const COLLECTION = 'pages'

function log(msg: string) {
  console.log(`  ${msg}`)
}

function logStep(msg: string) {
  console.log(`\n=> ${msg}`)
}

function normalizeContent(raw: string): string {
  return raw.replace(/\r\n/g, '\n')
}

async function authenticate(baseUrl: string): Promise<string> {
  const email = process.env.SCIFI_ADMIN_EMAIL ?? 'admin@arwes.dev'
  const password = process.env.SCIFI_ADMIN_PASSWORD ?? ''

  logStep(`Authenticating as ${email}...`)

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  if (!res.ok) {
    throw new Error(`Authentication failed (status ${res.status}): ${await res.text()}`)
  }

  const json = (await res.json()) as any
  if (!json.token) {
    throw new Error('Authentication succeeded but no token in response body.')
  }

  log('Authenticated successfully')
  return json.token as string
}

async function getPagesCollectionId(baseUrl: string, jwt: string): Promise<string> {
  logStep(`Fetching the "${COLLECTION}" collection id...`)

  const res = await fetch(`${baseUrl}/api/collections`, {
    headers: { Authorization: `Bearer ${jwt}` }
  })
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`)

  const json = (await res.json()) as any
  const list: any[] = json.data ?? json
  const collection = list.find((c: any) => c.name === COLLECTION)

  if (!collection) throw new Error(`Collection "${COLLECTION}" not found in CMS`)

  log(`collection ${COLLECTION}: ${collection.id}`)
  return collection.id as string
}

/** Existing entries by slug, so a re-run updates instead of duplicating. */
async function existingBySlug(baseUrl: string, jwt: string): Promise<Map<string, string>> {
  const res = await fetch(`${baseUrl}/api/collections/${COLLECTION}/content?limit=1000`, {
    headers: { Authorization: `Bearer ${jwt}` }
  })
  if (!res.ok) throw new Error(`Failed to list ${COLLECTION} content: ${res.status}`)

  const json = (await res.json()) as any
  const items: any[] = json.data ?? []
  return new Map(items.map((item) => [item.slug, item.id]))
}

async function seed(baseUrl: string, jwt: string) {
  const collectionId = await getPagesCollectionId(baseUrl, jwt)
  const existing = await existingBySlug(baseUrl, jwt)

  logStep('Upserting posts...')

  const files = await glob('**/*.md', { cwd: CONTENT_DIR })
  if (files.length === 0) {
    console.warn(`  No markdown files found in ${CONTENT_DIR}`)
  }

  let created = 0
  let updated = 0
  let errors = 0

  for (const file of files.sort()) {
    const raw = readFileSync(resolve(CONTENT_DIR, file), 'utf-8')
    const parsed = matter(raw)
    const fallbackSlug = basename(file, '.md')
    const slug = (parsed.data.slug ?? fallbackSlug) as string
    const title = (parsed.data.title ?? fallbackSlug) as string

    const payload = {
      collectionId,
      title,
      slug,
      status: 'published',
      data: {
        title,
        slug,
        content: normalizeContent(parsed.content),
        meta_description: parsed.data.meta_description ?? '',
        ...(parsed.data.featured_image ? { featured_image: parsed.data.featured_image } : {})
      }
    }

    const existingId = existing.get(slug)
    const res = await fetch(
      existingId ? `${baseUrl}/api/content/${existingId}` : `${baseUrl}/api/content`,
      {
        method: existingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`
        },
        body: JSON.stringify(payload)
      }
    )

    if (!res.ok) {
      console.error(`  ERROR ${existingId ? 'updating' : 'creating'} "${slug}": ${res.status} ${await res.text()}`)
      errors++
      continue
    }

    if (existingId) {
      updated++
      log(`Updated post: ${title} (/blog/${slug})`)
    } else {
      created++
      log(`Created post: ${title} (/blog/${slug})`)
    }
  }

  logStep('Summary')
  log(`Created: ${created}`)
  log(`Updated: ${updated}`)
  if (errors > 0) log(`Errors: ${errors}`)
  console.log('\nDone!\n')

  if (errors > 0) process.exit(1)
}

const args = process.argv.slice(2)
const baseUrl = args.find((arg) => !arg.startsWith('-'))?.replace(/\/+$/, '')

if (!baseUrl) {
  console.error('Usage:')
  console.error('  npx tsx scripts/seed-blog.ts <base-url> [--confirm-production]')
  console.error('')
  console.error('Examples:')
  console.error('  npx tsx scripts/seed-blog.ts http://localhost:8787')
  console.error('  npx tsx scripts/seed-blog.ts https://sci-fi-cms.your-subdomain.workers.dev --confirm-production')
  process.exit(1)
}

const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(baseUrl)
if (!isLocalhost && !args.includes('--confirm-production')) {
  console.error('')
  console.error('WARNING: You are about to write blog content to a production URL:')
  console.error(`  ${baseUrl}`)
  console.error('')
  console.error('Existing entries with the same slug are updated, nothing is deleted.')
  console.error('')
  console.error('To confirm, re-run with --confirm-production:')
  console.error(`  npx tsx scripts/seed-blog.ts ${baseUrl} --confirm-production`)
  console.error('')
  process.exit(1)
}

;(async () => {
  const jwt = await authenticate(baseUrl)
  await seed(baseUrl, jwt)
})().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
