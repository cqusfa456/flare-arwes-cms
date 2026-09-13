/**
 * Create the blog site (a content-only host) in the CMS.
 *
 * Why: the same repository can build the website and a blog on its own host. The
 * website keeps the app's routes plus the collections no other site claims; this
 * second site declares `content_routes = {"blog-posts": ""}`, so its build
 * publishes only the blog, at that host's root. Cloudflare Pages gives it
 * `<project>.pages.dev`; a custom subdomain is bound later from Admin → Sites.
 *
 * The build and deploy contract is copied from the existing website site, so the
 * two hosts stay in step.
 *
 * Usage:
 *   SCIFI_ADMIN_PASSWORD=... node scripts/create-blog-site.mjs <base-url> \
 *     [--from <site-slug>] [--slug arwes-blog] [--project arwes-blog] [--dry-run] [--confirm-production]
 */

const args = process.argv.slice(2)
const baseUrl = args.find((a) => !a.startsWith('-'))?.replace(/\/+$/, '')
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const SOURCE_SITE = value('from', 'arwes-docs-pages')
const NEW_SLUG = value('slug', 'arwes-blog')
const NEW_PROJECT = value('project', 'arwes-blog')
const dryRun = args.includes('--dry-run')

if (!baseUrl) {
  console.error(
    'Usage: node scripts/create-blog-site.mjs <base-url> [--from <site-slug>] [--slug arwes-blog] [--project arwes-blog] [--dry-run] [--confirm-production]'
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

const login = async () => {
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
  log(`Authenticated as ${process.env.SCIFI_ADMIN_EMAIL ?? 'admin@arwes.dev'}`)
  return json.token
}

const run = async () => {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${await login()}` }

  const list = await (await fetch(`${baseUrl}/admin/sites/api/sites`, { headers })).json()
  const sites = list.sites ?? list.data ?? []
  const source = sites.find((site) => site.slug === SOURCE_SITE)
  if (!source) {
    throw new Error(
      `Site "${SOURCE_SITE}" not found. Known sites: ${sites.map((s) => s.slug).join(', ') || '(none)'}`
    )
  }

  const payload = {
    slug: NEW_SLUG,
    name: 'ARWES Blog',
    description: 'The blog, published on its own host. Built from the same repository.',
    provider: source.provider,
    deployMode: source.deployMode ?? 'github-actions',
    cfProjectName: NEW_PROJECT,
    gitRepo: source.gitRepo,
    gitBranch: source.gitBranch ?? 'main',
    buildCommand: source.buildCommand,
    deployCommand: source.deployCommand,
    outputDir: source.outputDir,
    rootDir: source.rootDir,
    nodeVersion: source.nodeVersion,
    // The blog host publishes only the blog, at its own root.
    contentRoutes: { 'blog-posts': '' }
  }

  console.log('\n=> Payload')
  console.log(JSON.stringify(payload, null, 2))

  const existing = sites.find((site) => site.slug === NEW_SLUG)
  if (dryRun) {
    log(
      existing
        ? `Would update site "${NEW_SLUG}" (${existing.id})`
        : `Would create site "${NEW_SLUG}"`
    )
    return
  }

  const url = existing
    ? `${baseUrl}/admin/sites/api/sites/${existing.id}`
    : `${baseUrl}/admin/sites/api/sites`
  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  const body = await res.text()
  log(`${existing ? 'PATCH' : 'POST'} ${url} -> ${res.status}`)
  if (!res.ok) throw new Error(body)
  console.log(body.slice(0, 400))

  console.log('\n=> Next steps')
  log(`Deploy it:  POST ${baseUrl}/admin/sites/api/sites/<id>/build   (Admin → Sites → Deploy)`)
  log('The Pages project is created by the deploy workflow on the first run.')
  log(`Expected host: https://${NEW_PROJECT}.pages.dev`)
}

run().catch((error) => {
  console.error('Fatal error:', error.message ?? error)
  process.exit(1)
})
