/**
 * Admin → Sites routes.
 *
 * The CMS is the control plane for every website. These routes expose:
 *   * server-rendered pages (`/`, `/new`, `/:slug`)
 *   * a JSON API used by those pages for every mutation
 *
 * Everything here is admin-only. The Cloudflare API token is never returned to
 * a client, and Deploy Hook URLs are masked in JSON responses (they are
 * capability URLs) while still being rendered into the admin-only edit form.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { requireAuth, requireRole } from '../middleware'
import { SettingsService } from '../services/settings'
import { SitesService, SitesConfigError } from '../services/sites'
import type { Site, SiteInput } from '../services/sites'
import { logAudit, getClientIP } from '../services/audit-log'
import {
  renderSitesListPage,
  renderSiteNewPage,
  renderSiteDetailPage
} from '../templates/pages/admin-sites.template'
import type { Bindings, Variables } from '../app'

const adminSitesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminSitesRoutes.use('*', requireAuth())
adminSitesRoutes.use('*', requireRole('admin'))

/** Route context for this router, used by the small helpers below. */
type SitesContext = Context<{ Bindings: Bindings; Variables: Variables }>

const sitesService = (c: SitesContext): SitesService =>
  new SitesService(
    c.env.DB,
    c.env as unknown as Record<string, unknown>,
    new SettingsService(c.env.DB)
  )

/** Strip capability URLs before a site crosses the wire as JSON. */
const toPublicSite = (site: Site): Omit<Site, 'deployHookUrl'> & { hasDeployHook: boolean } => {
  const { deployHookUrl, ...rest } = site
  return { ...rest, hasDeployHook: !!deployHookUrl }
}

const pageUser = (user: Variables['user']): { name: string; email: string; role: string } | undefined =>
  user ? { name: user.email, email: user.email, role: user.role } : undefined

const errorResponse = (
  c: SitesContext,
  error: unknown,
  fallback: string
): Response => {
  if (error instanceof SitesConfigError) {
    return c.json({ success: false, error: error.message }, 400)
  }
  console.error(fallback, error)
  return c.json({ success: false, error: fallback }, 500)
}

const readJson = async (c: SitesContext): Promise<Record<string, unknown>> => {
  try {
    return await c.req.json<Record<string, unknown>>()
  } catch {
    return {}
  }
}

const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

// ---------------------------------------------------------------------------
// JSON API (registered first so /api/* never falls through to /:slug)
// ---------------------------------------------------------------------------

adminSitesRoutes.get('/api/credentials', async (c) => {
  const status = await sitesService(c).getCredentialStatus()
  return c.json({ success: true, ...status })
})

adminSitesRoutes.post('/api/credentials', async (c) => {
  const body = await readJson(c)
  try {
    await sitesService(c).saveCredentials({
      ...(str(body.accountId) === undefined ? {} : { accountId: String(body.accountId) }),
      ...(str(body.apiToken) === undefined ? {} : { apiToken: String(body.apiToken) })
    })
    return c.json({ success: true })
  } catch (error) {
    return errorResponse(c, error, 'Failed to save Cloudflare credentials')
  }
})

adminSitesRoutes.get('/api/sites', async (c) => {
  const sites = await sitesService(c).list()
  return c.json({ success: true, sites: sites.map(toPublicSite) })
})

adminSitesRoutes.post('/api/sites', async (c) => {
  const body = await readJson(c)
  try {
    const site = await sitesService(c).create(body as unknown as SiteInput)
    return c.json({ success: true, site: toPublicSite(site) }, 201)
  } catch (error) {
    return errorResponse(c, error, 'Failed to register site')
  }
})

adminSitesRoutes.patch('/api/sites/:id', async (c) => {
  const body = await readJson(c)
  try {
    const site = await sitesService(c).update(c.req.param('id'), body as Partial<SiteInput>)
    return c.json({ success: true, site: toPublicSite(site) })
  } catch (error) {
    return errorResponse(c, error, 'Failed to update site')
  }
})

adminSitesRoutes.delete('/api/sites/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  try {
    await sitesService(c).remove(id)
    // Audit logging is best-effort: a failure here must not fail the request.
    void logAudit(c.env.DB, {
      userId: user!.userId,
      userEmail: user!.email,
      action: 'sites.unregister',
      resourceType: 'site',
      resourceTitle: id,
      ipAddress: getClientIP(c.req)
    })
    return c.json({ success: true })
  } catch (error) {
    return errorResponse(c, error, 'Failed to unregister site')
  }
})

adminSitesRoutes.post('/api/sites/:id/build', async (c) => {
  const id = c.req.param('id')
  try {
    const result = await sitesService(c).triggerBuild(id)
    if (!result.ok) {
      return c.json({ success: false, error: result.error ?? 'Build trigger failed' }, 502)
    }
    return c.json({
      success: true,
      triggeredAt: result.triggeredAt,
      ...(result.buildId === undefined ? {} : { buildId: result.buildId }),
      ...(result.buildUrl === undefined ? {} : { buildUrl: result.buildUrl })
    })
  } catch (error) {
    return errorResponse(c, error, 'Failed to trigger build')
  }
})

adminSitesRoutes.get('/api/sites/:id/deployments', async (c) => {
  try {
    const deployments = await sitesService(c).listDeployments(c.req.param('id'))
    return c.json({ success: true, deployments })
  } catch (error) {
    return errorResponse(c, error, 'Failed to load deployments')
  }
})

adminSitesRoutes.post('/api/sites/:id/domains', async (c) => {
  const body = await readJson(c)
  const hostname = str(body.hostname) ?? ''
  try {
    const domain = await sitesService(c).addDomain(c.req.param('id'), hostname)
    return c.json({ success: true, domain }, 201)
  } catch (error) {
    return errorResponse(c, error, 'Failed to bind domain')
  }
})

adminSitesRoutes.delete('/api/sites/:id/domains/:hostname', async (c) => {
  try {
    await sitesService(c).removeDomain(c.req.param('id'), c.req.param('hostname'))
    return c.json({ success: true })
  } catch (error) {
    return errorResponse(c, error, 'Failed to unbind domain')
  }
})

adminSitesRoutes.post('/api/sites/:id/domains/refresh', async (c) => {
  try {
    const domains = await sitesService(c).refreshDomains(c.req.param('id'))
    return c.json({ success: true, domains })
  } catch (error) {
    return errorResponse(c, error, 'Failed to refresh domains')
  }
})

adminSitesRoutes.post('/api/sites/:id/domains/primary', async (c) => {
  const body = await readJson(c)
  const hostname = str(body.hostname) ?? ''
  try {
    await sitesService(c).setPrimaryDomain(c.req.param('id'), hostname)
    return c.json({ success: true })
  } catch (error) {
    return errorResponse(c, error, 'Failed to set the primary domain')
  }
})

adminSitesRoutes.post('/api/sites/:id/sync-build-config', async (c) => {
  try {
    const site = await sitesService(c).syncBuildConfig(c.req.param('id'))
    return c.json({ success: true, site: toPublicSite(site) })
  } catch (error) {
    return errorResponse(c, error, 'Failed to push build config to Cloudflare')
  }
})

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

adminSitesRoutes.get('/new', async (c) => {
  const service = sitesService(c)
  return c.html(
    renderSiteNewPage({
      credentials: await service.getCredentialStatus(),
      ...(pageUser(c.get('user')) ? { user: pageUser(c.get('user'))! } : {}),
      version: c.get('appVersion')
    })
  )
})

adminSitesRoutes.get('/', async (c) => {
  const service = sitesService(c)
  const sites = await service.list()

  const enriched = await Promise.all(
    sites.map(async (site) => {
      const [domains, counts] = await Promise.all([
        service.listDomains(site.id),
        service.contentCounts(site.id)
      ])
      return { ...site, domains, contentOwned: counts.owned, contentShared: counts.shared }
    })
  )

  const user = pageUser(c.get('user'))
  return c.html(
    renderSitesListPage({
      sites: enriched,
      credentials: await service.getCredentialStatus(),
      ...(user ? { user } : {}),
      version: c.get('appVersion')
    })
  )
})

adminSitesRoutes.get('/:slug', async (c) => {
  const service = sitesService(c)
  const site = await service.get(c.req.param('slug'))
  if (!site) return await c.notFound()

  const [domains, counts] = await Promise.all([
    service.listDomains(site.id),
    service.contentCounts(site.id)
  ])

  // Deployments need Cloudflare credentials; a missing/unusable token should
  // degrade the panel, not break the page.
  let deployments: Awaited<ReturnType<SitesService['listDeployments']>> = []
  let deploymentsError: string | null = null
  try {
    deployments = await service.listDeployments(site.id, 5)
  } catch (error) {
    deploymentsError = error instanceof Error ? error.message : 'Could not load deployments'
  }

  const user = pageUser(c.get('user'))
  return c.html(
    renderSiteDetailPage({
      site,
      domains,
      deployments,
      deploymentsError,
      contentOwned: counts.owned,
      contentShared: counts.shared,
      credentials: await service.getCredentialStatus(),
      ...(user ? { user } : {}),
      version: c.get('appVersion')
    })
  )
})

export { adminSitesRoutes }
