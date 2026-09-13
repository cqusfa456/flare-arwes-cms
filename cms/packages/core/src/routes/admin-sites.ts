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
import { SitesService, SitesConfigError, buildSiteEnvironment } from '../services/sites'
import type { Site, SiteInput, SiteDeployMode, SiteContentRoutesInput } from '../services/sites'
import { SITE_DEPLOY_MODES, deployModeLabel, defaultDeployMode } from '../services/sites'
import { SITE_PROVIDERS, getSiteProvider } from '../services/site-providers'
import { ARWES_SITE_PRESETS } from '../services/site-presets'
import { githubDeployStatus } from '../services/github-actions'
import type { GithubDeployStatus } from '../services/github-actions'
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

/**
 * Strip capabilities and secrets before a site crosses the wire as JSON: the
 * Deploy Hook URL and the build content token are both bearer credentials.
 */
const toPublicSite = (
  site: Site
): Omit<Site, 'deployHookUrl' | 'contentToken' | 'contentTokenId'> & {
  hasDeployHook: boolean
  hasContentToken: boolean
} => {
  const { deployHookUrl, contentToken, contentTokenId, ...rest } = site
  return {
    ...rest,
    hasDeployHook: !!deployHookUrl,
    hasContentToken: !!(contentToken && contentTokenId)
  }
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

/**
 * Read a site payload's content-routes field.
 *
 * The admin form posts it as `content_routes` — the column name, matching the
 * collections API's `url_prefix` — while a JSON API client may use the camelCase
 * `contentRoutes` that the rest of a site payload uses; both are accepted. The
 * value may be an object, a JSON string or null/absent, and is normalised and
 * validated against `collections.name` by `services/sites.ts`. Returning
 * `undefined` for an absent field is what makes a PATCH leave the stored value
 * alone (so an old client cannot silently clear it).
 */
const contentRoutesInput = (body: Record<string, unknown>): SiteContentRoutesInput | undefined => {
  const value = body.contentRoutes !== undefined ? body.contentRoutes : body.content_routes
  if (value === undefined) return undefined
  return value as SiteContentRoutesInput
}

/** Site payloads, with `content_routes` folded onto the camelCase input field. */
const siteInputFrom = (body: Record<string, unknown>): SiteInput => {
  const contentRoutes = contentRoutesInput(body)
  return {
    ...body,
    ...(contentRoutes === undefined ? {} : { contentRoutes })
  } as unknown as SiteInput
}

/** Read an optional string binding without widening the Bindings type. */
const envString = (c: SitesContext, key: string): string => {
  const value = (c.env as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

/**
 * Base URL the CMS advertises to builds (`PUBLIC_SCIFI_API_URL`).
 *
 * A site may pin it in its own build env; otherwise a deployed `SCIFI_API_URL`
 * is used, and as a last resort the origin the admin happens to be using (which
 * is correct for a single-domain deployment).
 */
const apiBaseUrlFor = (c: SitesContext, site?: Site): string | null => {
  // PUBLIC_FLARE_API_URL / FLARE_API_URL are the pre-rename spellings: a site
  // pinned before the rename — or a Worker var not yet renamed — still resolves,
  // and its value is carried forward onto the PUBLIC_SCIFI_* key.
  const pinned =
    site?.buildEnv?.PUBLIC_SCIFI_API_URL?.value ?? site?.buildEnv?.PUBLIC_FLARE_API_URL?.value
  if (pinned) return pinned
  const fromEnv = envString(c, 'SCIFI_API_URL') || envString(c, 'FLARE_API_URL')
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  try {
    return new URL(c.req.url).origin
  } catch {
    return null
  }
}

/** Keys the CMS owns on the trigger; everything else is operator-defined. */
const MANAGED_BUILD_ENV_KEYS = [
  'PUBLIC_SCIFI_API_URL',
  'PUBLIC_SCIFI_SITE',
  'PUBLIC_SCIFI_API_TOKEN'
]

/** Deploy-mode options for the admin forms (value + label). */
const deployModeOptions = (): Array<{ id: SiteDeployMode; label: string }> =>
  SITE_DEPLOY_MODES.map((mode) => ({ id: mode, label: deployModeLabel(mode) }))

/** GitHub dispatch configuration, for the pages that offer "Deploy". */
const githubStatusFor = (c: SitesContext, site?: Site): Promise<GithubDeployStatus> =>
  githubDeployStatus(
    c.env as unknown as Record<string, unknown>,
    new SettingsService(c.env.DB),
    site
  )

/** Show a token's prefix, never its secret. */
const maskSecret = (value: string): string =>
  value.length > 12 ? `${value.slice(0, 11)}…` : '••••••'

/**
 * The build environment a sync would push, safe to render in the admin page:
 * secrets are reduced to a prefix.
 */
const buildEnvView = (
  site: Site,
  apiBaseUrl: string | null
): Array<{ key: string; value: string; secret: boolean; managed: boolean }> => {
  const env = buildSiteEnvironment(site, { apiBaseUrl, contentToken: site.contentToken })

  return Object.entries(env)
    .map(([key, entry]) => ({
      key,
      value: entry.secret ? maskSecret(entry.value) : entry.value,
      secret: entry.secret === true,
      managed: MANAGED_BUILD_ENV_KEYS.includes(key)
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

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
    const site = await sitesService(c).create(siteInputFrom(body))
    return c.json({ success: true, site: toPublicSite(site) }, 201)
  } catch (error) {
    return errorResponse(c, error, 'Failed to register site')
  }
})

adminSitesRoutes.patch('/api/sites/:id', async (c) => {
  const body = await readJson(c)
  try {
    const site = await sitesService(c).update(
      c.req.param('id'),
      siteInputFrom(body) as Partial<SiteInput>
    )
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
  const body = await readJson(c)
  const via = body.via === 'hook' || body.via === 'api' ? body.via : undefined
  try {
    const result = await sitesService(c).triggerBuild(id, via ? { via } : {})
    if (!result.ok) {
      return c.json({ success: false, error: result.error ?? 'Build trigger failed' }, 502)
    }
    return c.json({
      success: true,
      triggeredAt: result.triggeredAt,
      ...(result.via === undefined ? {} : { via: result.via }),
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
  const body = await readJson(c)
  const id = c.req.param('id')
  const user = c.get('user')
  try {
    const service = sitesService(c)
    const site = await service.get(id)
    const result = await service.syncBuildConfig(id, {
      apiBaseUrl: apiBaseUrlFor(c, site ?? undefined),
      rotateToken: body.rotateToken === true,
      ...(user ? { ownerUserId: user.userId } : {})
    })
    return c.json({
      success: true,
      site: toPublicSite(result.site),
      envPushed: result.envPushed,
      envKeys: result.envKeys,
      notes: result.notes
    })
  } catch (error) {
    return errorResponse(c, error, 'Failed to push build config to Cloudflare')
  }
})

/**
 * Push only the build environment (the PUBLIC_SCIFI_* values plus the site's own
 * variables). Split from the build-settings sync so an operator can re-issue the
 * content token without touching the trigger's commands.
 */
adminSitesRoutes.post('/api/sites/:id/build-env', async (c) => {
  const body = await readJson(c)
  const id = c.req.param('id')
  const user = c.get('user')
  try {
    const service = sitesService(c)
    const site = await service.get(id)
    const result = await service.pushBuildEnvironment(id, {
      apiBaseUrl: apiBaseUrlFor(c, site ?? undefined),
      rotateToken: body.rotateToken === true,
      ...(user ? { ownerUserId: user.userId } : {})
    })
    return c.json({
      success: true,
      site: toPublicSite(result.site),
      envKeys: result.envKeys,
      notes: result.notes
    })
  } catch (error) {
    return errorResponse(c, error, 'Failed to push the build environment')
  }
})

// ---------------------------------------------------------------------------
// Presets — the monorepo's build contract, offered as one-click registrations
// ---------------------------------------------------------------------------

adminSitesRoutes.get('/api/presets', (c) =>
  c.json({
    success: true,
    presets: ARWES_SITE_PRESETS.map((preset) => ({
      id: preset.id,
      name: preset.name,
      slug: preset.slug,
      provider: preset.provider,
      providerLabel: getSiteProvider(preset.provider).label,
      cfProjectName: preset.cfProjectName,
      description: preset.description,
      gitRepo: preset.gitRepo,
      gitBranch: preset.gitBranch,
      buildCommand: preset.buildCommand,
      deployCommand: preset.deployCommand,
      rootDir: preset.rootDir,
      outputDir: preset.outputDir,
      app: preset.app,
      template: preset.template === true,
      notes: preset.notes
    }))
  })
)

adminSitesRoutes.post('/api/presets/import', async (c) => {
  try {
    const result = await sitesService(c).importPresets()
    return c.json({ success: true, ...result })
  } catch (error) {
    return errorResponse(c, error, 'Failed to import site presets')
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
      providers: SITE_PROVIDERS,
      presets: ARWES_SITE_PRESETS,
      deployModes: deployModeOptions(),
      github: await githubStatusFor(c),
      ...(pageUser(c.get('user')) ? { user: pageUser(c.get('user'))! } : {}),
      version: c.get('appVersion')
    })
  )
})

adminSitesRoutes.get('/', async (c) => {
  const service = sitesService(c)
  const sites = await service.list()

  const requestedType = str(c.req.query('type'))
  const typeFilter =
    requestedType && SITE_PROVIDERS.some((provider) => provider.id === requestedType)
      ? (requestedType as Site['provider'])
      : null

  const visible = typeFilter ? sites.filter((site) => site.provider === typeFilter) : sites

  const enriched = await Promise.all(
    visible.map(async (site) => {
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
      providers: SITE_PROVIDERS,
      typeFilter,
      totalCount: sites.length,
      presets: ARWES_SITE_PRESETS,
      credentials: await service.getCredentialStatus(),
      github: await githubStatusFor(c),
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
      capabilities: service.capabilities(site),
      buildEnv: buildEnvView(site, apiBaseUrlFor(c, site)),
      isPreset: ARWES_SITE_PRESETS.some((preset) => preset.slug === site.slug),
      deployModes: deployModeOptions(),
      effectiveDeployMode: service.effectiveDeployMode(site),
      github: await githubStatusFor(c, site),
      ...(user ? { user } : {}),
      version: c.get('appVersion')
    })
  )
})

export { adminSitesRoutes }
