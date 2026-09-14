/**
 * Publish the site's shared chrome — the components and the layouts — into the CMS.
 *
 * The chrome is part of the site's content, not its code:
 *
 *   components  the pieces a site repeats on every page (Admin -> Content ->
 *               Components): the navigation bar, the footer bar, ... A component is
 *               markup (an Astro file) and may also carry the menu it renders (a
 *               JSON file of the same key), which is how the bars get their links.
 *   layouts     the page frames, which compose the components and render the page
 *               through a <slot /> (Admin -> Content -> Layouts). Several versions
 *               coexist and each page picks one with its own `layout` field.
 *
 * This script uploads the repository's fixtures for both, so a new environment gets
 * the same starting point and a change made in the repository can be re-applied:
 *
 *   cms/packages/cms/content/components/<key>.astro -> components/<key> (field `astro`)
 *   cms/packages/cms/content/components/<key>.json  -> components/<key> (field `items`)
 *   cms/packages/cms/content/layouts/<key>.astro    -> layouts/<key>    (field `astro`)
 *
 * An entry that already exists is left as it is — the CMS is the source of truth once
 * an operator has edited it there; `--force` replaces it with the fixture.
 *
 * Usage:
 *   SCIFI_ADMIN_PASSWORD=... node scripts/seed-cms-chrome.mjs <base-url> \
 *     [--dry-run] [--confirm-production]
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const baseUrl = args.find((a) => !a.startsWith('-'))?.replace(/\/+$/, '')
const dryRun = args.includes('--dry-run')
// Fixtures are a starting point, not a source of truth: an entry that already
// exists is left as it is unless the operator asks for it to be replaced.
const force = args.includes('--force')

if (!baseUrl) {
  console.error(
    'Usage: node scripts/seed-cms-chrome.mjs <base-url> [--dry-run] [--confirm-production]'
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

const CONTENT_DIR = resolve(import.meta.dirname ?? '.', '..', 'cms', 'packages', 'cms', 'content')
const log = (message) => console.log(`  ${message}`)

/** Files of a fixture directory, as [key, path] pairs. */
const fixtures = (directory, extension) => {
  const dir = join(CONTENT_DIR, directory)
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => name.endsWith(extension))
    .map((name) => [name.slice(0, -extension.length), join(dir, name)])
}

const run = async () => {
  const components = fixtures('components', '.astro')
  const componentMenus = fixtures('components', '.json')
  const layouts = fixtures('layouts', '.astro')
  log(
    `${components.length} component(s), ${componentMenus.length} menu(s), ${layouts.length} layout(s) in the repository`
  )
  // Said before anything is written: an entry with the same key is replaced by the
  // repository's fixture, so an edit made in the admin is lost.
  log('note: existing entries are left as they are; --force replaces them')

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
  const collections =
    (await (await fetch(`${baseUrl}/api/collections`, { headers })).json()).data ?? []
  const collectionId = (name) => {
    const collection = collections.find((item) => item.name === name)
    if (!collection) throw new Error(`The CMS has no "${name}" collection`)
    return collection.id
  }

  const upsert = async (name, key, title, data) => {
    const replaceExisting = force
    const existing =
      (
        await (
          await fetch(`${baseUrl}/api/collections/${name}/content?limit=1000`, { headers })
        ).json()
      ).data ?? []
    const match = existing.find((item) => item.slug === key)
    const payload = {
      collectionId: collectionId(name),
      title,
      slug: key,
      status: 'published',
      // Keep the rest of the entry: this script owns only the fields it uploads.
      data: { ...(match?.data ?? {}), title, slug: key, ...data }
    }
    if (match && !replaceExisting) {
      log(`${name}/${key}: exists, left as it is (--force replaces it)`)
      return
    }
    if (dryRun) {
      log(`${name}/${key}: ${match ? 'would be updated' : 'would be created'}`)
      return
    }
    const res = await fetch(
      match ? `${baseUrl}/api/content/${match.id}` : `${baseUrl}/api/content`,
      {
        method: match ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload)
      }
    )
    const body = await res.text()
    log(`${name}/${key}: ${match ? 'PUT' : 'POST'} -> ${res.status}`)
    if (!res.ok) throw new Error(body)
  }

  for (const [key, file] of components) {
    const astro = readFileSync(file, 'utf-8')
    await upsert('components', key, `Component: ${key}`, { key, astro })
  }

  for (const [key, file] of componentMenus) {
    const menu = JSON.parse(readFileSync(file, 'utf-8'))
    await upsert('components', key, `Component: ${key}`, {
      key,
      name: menu.name ?? `Menu: ${key}`,
      items: JSON.stringify(menu.items ?? [])
    })
  }

  for (const [key, file] of layouts) {
    const astro = readFileSync(file, 'utf-8')
    await upsert('layouts', key, `Layout: ${key}`, { key, astro })
  }

  log(dryRun ? 'dry run: nothing was written' : 'done')
}

run().catch((error) => {
  console.error('Fatal error:', error.message ?? error)
  process.exit(1)
})
