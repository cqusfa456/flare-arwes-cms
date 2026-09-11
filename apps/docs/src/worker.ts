/**
 * Static-assets Worker for the docs site (and, optionally, other sites).
 *
 * Why a Worker instead of Pages: a Worker can be attached to **many custom
 * domains**, so one deployment can serve several sites — a Pages setup needs one
 * project (with its own build settings and deploy hook) per site.
 *
 * How it serves files
 * -------------------
 * The bundle is configured with `assets.html_handling: "none"` and
 * `run_worker_first: true`, so Cloudflare does no implicit HTML rewriting and
 * this script decides every response. That is deliberate: Astro emits
 * `build.format: 'directory'`, whose pages live at `about/index.html`, and
 * relying on Cloudflare's `auto-trailing-slash` would answer `/about` with a
 * 307 redirect to `/about/`. Resolving the index here keeps URLs stable and
 * behaves identically for the single-site and multi-site layouts.
 *
 * Layouts
 * -------
 *  * **Single site (default)** — assets sit at the bundle root, no configuration
 *    needed. Any number of custom domains can point at this Worker.
 *  * **Several sites on one Worker** — each site's output is placed under a
 *    prefix (`sites/<slug>/…`) and mapped from hostname via `SITE_ROUTES`.
 *    Requests for an unmapped host fall back to `DEFAULT_SITE_PREFIX`, or to the
 *    bundle root when that is unset.
 *
 * Environment
 * -----------
 *  * `SITE_ROUTES`          — JSON map of hostname → asset prefix, for example
 *                             `{"docs.example.com":"/sites/docs","blog.example.com":"/sites/blog"}`
 *  * `DEFAULT_SITE_PREFIX`  — asset prefix used for hosts missing from `SITE_ROUTES`
 */

/** The static-assets binding exposed by the `assets` configuration. */
interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>
}

interface Env {
  ASSETS: AssetsBinding
  SITE_ROUTES?: string
  DEFAULT_SITE_PREFIX?: string
}

/** `''`, `/`, `sites/docs` and `/sites/docs/` all normalise to `/sites/docs`. */
export const normalizePrefix = (prefix: string | undefined): string => {
  const trimmed = (prefix ?? '').trim()
  if (trimmed === '' || trimmed === '/') return ''
  return `/${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

/** Parse the hostname → prefix map, ignoring anything malformed. */
export const parseSiteRoutes = (raw: string | undefined): Record<string, string> => {
  if (!raw) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[docs-worker] SITE_ROUTES is not valid JSON; falling back to the default prefix')
    return {}
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('[docs-worker] SITE_ROUTES must be a JSON object of hostname → prefix')
    return {}
  }

  const routes: Record<string, string> = {}
  for (const [host, prefix] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof prefix !== 'string') continue
    routes[host.trim().toLowerCase().replace(/:\d+$/, '')] = normalizePrefix(prefix)
  }
  return routes
}

/** Hostname without a port, lowercased. */
export const requestHost = (request: Request): string => {
  const header = request.headers.get('host')
  const host = header && header !== '' ? header : new URL(request.url).hostname
  return host.toLowerCase().replace(/:\d+$/, '')
}

/**
 * Asset paths to try, in order.
 *
 * Only extension-less paths get the directory/`.html` fallbacks, so a request
 * for `/assets/app.js` is answered by exactly that file.
 */
export const candidatePaths = (prefix: string, pathname: string): string[] => {
  const base = `${prefix}${pathname}`
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return [base]

  const candidates = [base]
  candidates.push(base.endsWith('/') ? `${base}index.html` : `${base}/index.html`)
  candidates.push(`${base}.html`)
  return candidates
}

const assetRequest = (request: Request, path: string, origin: string): Request =>
  new Request(new URL(path, origin).toString(), {
    method: request.method,
    headers: request.headers
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD' }
      })
    }

    const url = new URL(request.url)
    const routes = parseSiteRoutes(env.SITE_ROUTES)
    const prefix = routes[requestHost(request)] ?? normalizePrefix(env.DEFAULT_SITE_PREFIX)

    for (const candidate of candidatePaths(prefix, url.pathname)) {
      const response = await env.ASSETS.fetch(assetRequest(request, candidate, url.origin))
      if (response.status !== 404) return response
    }

    // Per-site 404 page when the site ships one.
    const notFound = await env.ASSETS.fetch(assetRequest(request, `${prefix}/404.html`, url.origin))
    if (notFound.status !== 404) {
      return new Response(notFound.body, { status: 404, headers: notFound.headers })
    }

    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}
