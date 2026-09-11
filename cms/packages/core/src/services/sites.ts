/**
 * Sites service — the CMS as the control plane for every website.
 *
 * Responsibilities
 * ----------------
 *  * **Registry**: each site (Pages project, Git repo, build settings, content
 *    prefix) is a row in `sites`, editable from Admin → Sites.
 *  * **Builds**: rebuilding a site means POSTing its Cloudflare Pages Deploy
 *    Hook. Pages performs the build, so the CMS never runs a site build and no
 *    site build lives in GitHub Actions.
 *  * **Domains**: custom domain bindings are created/removed through the
 *    Cloudflare API and their validation state is mirrored into `site_domains`.
 *  * **Content ownership**: `content.site_id` scopes content to a site; NULL
 *    means shared content that every site may read.
 *
 * Credentials are resolved environment-first (`CF_API_TOKEN` /
 * `CF_ACCOUNT_ID` Worker secrets) and fall back to DB settings so an operator
 * can rotate them from the admin UI without a redeploy. The API token is never
 * returned to a client — see {@link SitesService.getCredentialStatus}.
 */

import type { SettingsService } from './settings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Where a site is hosted.
 *
 *  * `cloudflare-pages`  — a Pages project; domains via the Pages domains API,
 *    builds via a Pages Deploy Hook, build settings via the Pages project's
 *    `build_config`.
 *  * `cloudflare-worker` — a Worker with static assets; domains via the Workers
 *    domains API (requires a zone), builds via a Workers Builds Deploy Hook,
 *    build settings on a Workers Builds trigger. One Worker can serve many
 *    custom domains, which is why this is the preferred provider for a
 *    multi-site deployment.
 *  * `external`          — anything else; the CMS only records it.
 */
export type SiteProvider = 'cloudflare-pages' | 'cloudflare-worker' | 'external'

/** Hosting providers that the CMS can actually drive through the Cloudflare API. */
export const CLOUDFLARE_HOSTING_PROVIDERS: SiteProvider[] = [
  'cloudflare-pages',
  'cloudflare-worker'
]

/** 'pending' | 'active' | 'error' | 'removed' */
export type SiteDomainStatus = 'pending' | 'active' | 'error' | 'removed'

export interface SiteDomain {
  id: string
  siteId: string
  hostname: string
  status: SiteDomainStatus
  cfDomainId: string | null
  /** Zone the Worker custom domain was bound in (Workers provider only). */
  cfZoneId: string | null
  validationStatus: string | null
  validationErrors: string | null
  isPrimary: boolean
  createdAt: number
  updatedAt: number
}

export interface Site {
  id: string
  slug: string
  name: string
  description: string | null
  provider: SiteProvider
  /** Pages project name (Pages provider) or Worker name (Worker provider). */
  cfProjectName: string | null
  /** Workers Builds identifies Workers by immutable tag, not by name. */
  cfWorkerTag: string | null
  /** Workers Builds production trigger, where build settings live. */
  cfTriggerUuid: string | null
  /** Optional pinned Cloudflare zone for Worker custom domains. */
  cfZoneId: string | null
  gitRepo: string | null
  gitBranch: string | null
  /** Present but never serialized to the client by the routes layer. */
  deployHookUrl: string | null
  buildCommand: string | null
  /** Workers Builds runs build and deploy as separate commands. */
  deployCommand: string | null
  outputDir: string | null
  rootDir: string | null
  nodeVersion: string | null
  buildConfigSyncedAt: number | null
  contentPrefix: string | null
  isActive: boolean
  lastBuildAt: number | null
  lastBuildStatus: string | null
  lastBuildId: string | null
  lastBuildUrl: string | null
  lastBuildError: string | null
  createdAt: number
  updatedAt: number
}

export interface SiteInput {
  slug: string
  name: string
  description?: string | null
  provider?: SiteProvider
  cfProjectName?: string | null
  cfWorkerTag?: string | null
  cfTriggerUuid?: string | null
  cfZoneId?: string | null
  gitRepo?: string | null
  gitBranch?: string | null
  deployHookUrl?: string | null
  buildCommand?: string | null
  deployCommand?: string | null
  outputDir?: string | null
  rootDir?: string | null
  nodeVersion?: string | null
  contentPrefix?: string | null
  isActive?: boolean
}

export interface CloudflareCredentialStatus {
  configured: boolean
  source: 'env' | 'settings' | 'none'
  accountId: string | null
}

export interface BuildTriggerResult {
  ok: boolean
  siteId: string
  triggeredAt: number
  /** Deploy hook response body, when Pages returns one. */
  buildId?: string
  buildUrl?: string
  /** Workers Builds returned an already-queued build instead of a new one. */
  alreadyExists?: boolean
  error?: string
}

export interface SiteDeploymentInfo {
  id: string
  url: string | null
  environment: string | null
  stage: string | null
  status: string | null
  createdAt: string | null
}

/** Raised for operator-fixable problems so routes can answer 400 instead of 500. */
export class SitesConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SitesConfigError'
  }
}

// ---------------------------------------------------------------------------
// Env / settings access
// ---------------------------------------------------------------------------

type Env = Record<string, unknown>

const readString = (env: Env | undefined, key: string): string => {
  const value = env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

interface CloudflareCredentials {
  accountId: string
  apiToken: string
  source: 'env' | 'settings'
}

interface CloudflareEnvelope<T> {
  success?: boolean
  result?: T
  errors?: Array<{ code?: number; message?: string }>
  messages?: unknown
}

const rowToSite = (row: Record<string, unknown>): Site => ({
  id: String(row.id),
  slug: String(row.slug),
  name: String(row.name),
  description: (row.description as string | null) ?? null,
  provider: ((row.provider as string) || 'cloudflare-pages') as SiteProvider,
  cfProjectName: (row.cf_project_name as string | null) ?? null,
  cfWorkerTag: (row.cf_worker_tag as string | null) ?? null,
  cfTriggerUuid: (row.cf_trigger_uuid as string | null) ?? null,
  cfZoneId: (row.cf_zone_id as string | null) ?? null,
  gitRepo: (row.git_repo as string | null) ?? null,
  gitBranch: (row.git_branch as string | null) ?? null,
  deployHookUrl: (row.deploy_hook_url as string | null) ?? null,
  buildCommand: (row.build_command as string | null) ?? null,
  deployCommand: (row.deploy_command as string | null) ?? null,
  outputDir: (row.output_dir as string | null) ?? null,
  rootDir: (row.root_dir as string | null) ?? null,
  nodeVersion: (row.node_version as string | null) ?? null,
  buildConfigSyncedAt: (row.build_config_synced_at as number | null) ?? null,
  contentPrefix: (row.content_prefix as string | null) ?? null,
  isActive: Number(row.is_active ?? 1) === 1,
  lastBuildAt: (row.last_build_at as number | null) ?? null,
  lastBuildStatus: (row.last_build_status as string | null) ?? null,
  lastBuildId: (row.last_build_id as string | null) ?? null,
  lastBuildUrl: (row.last_build_url as string | null) ?? null,
  lastBuildError: (row.last_build_error as string | null) ?? null,
  createdAt: Number(row.created_at ?? 0),
  updatedAt: Number(row.updated_at ?? 0)
})

const rowToDomain = (row: Record<string, unknown>): SiteDomain => ({
  id: String(row.id),
  siteId: String(row.site_id),
  hostname: String(row.hostname),
  status: ((row.status as string) || 'pending') as SiteDomainStatus,
  cfDomainId: (row.cf_domain_id as string | null) ?? null,
  cfZoneId: (row.cf_zone_id as string | null) ?? null,
  validationStatus: (row.validation_status as string | null) ?? null,
  validationErrors: (row.validation_errors as string | null) ?? null,
  isPrimary: Number(row.is_primary ?? 0) === 1,
  createdAt: Number(row.created_at ?? 0),
  updatedAt: Number(row.updated_at ?? 0)
})

/** Normalise an operator-entered slug into a URL-safe identifier. */
export const normalizeSiteSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/** Normalise a hostname (strip scheme/path, lowercase). */
export const normalizeHostname = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')

const isHostname = (value: string): boolean =>
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(value)

/** Map Cloudflare's Pages domain payload onto our status vocabulary. */
const mapCloudflareDomainStatus = (payload: Record<string, unknown>): SiteDomainStatus => {
  const status = String(payload.status ?? '').toLowerCase()
  const validation = payload.validation_data as Record<string, unknown> | undefined
  const validationStatus = String(validation?.status ?? '').toLowerCase()

  if (status === 'active' && (validationStatus === '' || validationStatus === 'active')) {
    return 'active'
  }
  if (validationStatus === 'error' || status === 'error' || status === 'blocked') {
    return 'error'
  }
  return 'pending'
}

// ---------------------------------------------------------------------------
// SitesService
// ---------------------------------------------------------------------------

export class SitesService {
  constructor(
    private readonly db: D1Database,
    private readonly env: Env = {},
    private readonly settings?: SettingsService
  ) {}

  // -- credentials ----------------------------------------------------------

  /**
   * Resolve Cloudflare API credentials. Worker secrets win; DB settings are the
   * fallback so the token can be rotated without a redeploy.
   */
  private async credentials(): Promise<CloudflareCredentials | null> {
    const envToken = readString(this.env, 'CF_API_TOKEN')
    const envAccount = readString(this.env, 'CF_ACCOUNT_ID')

    if (envToken && envAccount) {
      return { apiToken: envToken, accountId: envAccount, source: 'env' }
    }

    if (this.settings) {
      const token = await this.settings.getSetting('sites', 'cf_api_token')
      const account = await this.settings.getSetting('sites', 'cf_account_id')
      if (token && account) {
        return {
          apiToken: String(token),
          accountId: String(account),
          source: 'settings'
        }
      }
    }

    return null
  }

  /** Whether Cloudflare write operations are possible — never leaks the token. */
  async getCredentialStatus(): Promise<CloudflareCredentialStatus> {
    const credentials = await this.credentials()
    if (!credentials) {
      return { configured: false, source: 'none', accountId: null }
    }
    return {
      configured: true,
      source: credentials.source,
      // Account ID is not a secret and is useful for support/debugging.
      accountId: credentials.accountId
    }
  }

  /** Persist Cloudflare API credentials in DB settings. */
  async saveCredentials(input: { accountId?: string; apiToken?: string }): Promise<void> {
    if (!this.settings) throw new SitesConfigError('Settings service unavailable')
    if (input.accountId !== undefined) {
      await this.settings.setSetting('sites', 'cf_account_id', input.accountId.trim())
    }
    if (input.apiToken !== undefined && input.apiToken.trim() !== '') {
      await this.settings.setSetting('sites', 'cf_api_token', input.apiToken.trim())
    }
  }

  private async requireCredentials(): Promise<CloudflareCredentials> {
    const credentials = await this.credentials()
    if (!credentials) {
      throw new SitesConfigError(
        'Cloudflare API credentials are not configured. Set CF_API_TOKEN and CF_ACCOUNT_ID as Worker secrets, or save them in Admin → Sites → Settings.'
      )
    }
    return credentials
  }

  // -- provider-aware helpers ----------------------------------------------

  /**
   * Both Cloudflare providers need a Pages project / Worker name to act on.
   * `external` sites are registry-only.
   */
  private requireTarget(site: Site): string {
    if (site.provider === 'external') {
      throw new SitesConfigError(
        `Site "${site.slug}" is hosted externally; the CMS can only record it`
      )
    }
    if (!site.cfProjectName) {
      throw new SitesConfigError(
        site.provider === 'cloudflare-worker'
          ? `Site "${site.slug}" has no Worker name configured`
          : `Site "${site.slug}" has no Cloudflare Pages project configured`
      )
    }
    return site.cfProjectName
  }

  /**
   * Workers Builds identifies Workers by an immutable **tag**
   * (`external_script_id`), not by name. Resolve it once and cache it on the
   * site row; pass `refresh` to re-resolve after a 404.
   */
  private async resolveWorkerTag(site: Site, options: { refresh?: boolean } = {}): Promise<string> {
    const workerName = this.requireTarget(site)
    if (site.cfWorkerTag && !options.refresh) return site.cfWorkerTag

    const { accountId } = await this.requireCredentials()
    const scripts = await this.cf<Array<Record<string, unknown>>>(
      `/accounts/${accountId}/workers/scripts`
    )
    const list = scripts ?? []
    const match = list.find((script) => String(script.id ?? '') === workerName)
    const tag = match ? String(match.tag ?? '') : ''
    if (!tag) {
      throw new SitesConfigError(
        `Worker "${workerName}" was not found in this Cloudflare account (checked ${list.length} scripts). Check the Worker name, and that the API token can read Workers scripts.`
      )
    }

    await this.db
      .prepare('UPDATE sites SET cf_worker_tag = ?, updated_at = ? WHERE id = ?')
      .bind(tag, Date.now(), site.id)
      .run()

    return tag
  }

  /**
   * Workers Builds keeps build settings on a **trigger**, not on the Worker.
   * Prefer the trigger that builds this site's branch.
   */
  private async resolveProductionTrigger(
    site: Site,
    options: { refresh?: boolean } = {}
  ): Promise<string> {
    if (site.cfTriggerUuid && !options.refresh) return site.cfTriggerUuid

    const tag = await this.resolveWorkerTag(site)
    const { accountId } = await this.requireCredentials()
    const triggers = await this.cf<Array<Record<string, unknown>>>(
      `/accounts/${accountId}/builds/workers/${tag}/triggers`
    )
    const list = triggers ?? []
    if (list.length === 0) {
      throw new SitesConfigError(
        `Worker "${site.cfProjectName}" has no Workers Builds trigger yet. Connect it to a Git repository in Cloudflare (Worker → Settings → Builds) and create a trigger.`
      )
    }

    const branch = site.gitBranch || 'main'
    const preferred =
      list.find((trigger) => {
        const includes = trigger.branch_includes
        return Array.isArray(includes) && includes.map(String).includes(branch)
      }) ?? list[0]

    const uuid = String(preferred?.trigger_uuid ?? '')
    if (!uuid) throw new SitesConfigError('Workers Builds returned a trigger without a uuid')

    await this.db
      .prepare('UPDATE sites SET cf_trigger_uuid = ?, updated_at = ? WHERE id = ?')
      .bind(uuid, Date.now(), site.id)
      .run()

    return uuid
  }

  /**
   * A Worker custom domain must name the **zone** it belongs to (a Pages custom
   * domain only needs the hostname). Use the site's pinned zone when set,
   * otherwise match the hostname against the zones this token can see — the
   * longest suffix wins, so `example.co.uk` beats `co.uk`.
   */
  private async resolveZoneId(site: Site, hostname: string): Promise<string> {
    if (site.cfZoneId) return site.cfZoneId

    const { accountId } = await this.requireCredentials()
    const zones = await this.cf<Array<Record<string, unknown>>>(
      `/zones?per_page=50&account.id=${encodeURIComponent(accountId)}`
    )
    const list = zones ?? []

    const matches = list
      .map((zone) => ({
        id: String(zone.id ?? ''),
        name: String(zone.name ?? '').toLowerCase()
      }))
      .filter(
        (zone) =>
          zone.id !== '' &&
          zone.name !== '' &&
          (hostname === zone.name || hostname.endsWith(`.${zone.name}`))
      )
      .sort((a, b) => b.name.length - a.name.length)

    const winner = matches[0]
    if (!winner) {
      throw new SitesConfigError(
        `"${hostname}" is not inside any Cloudflare zone this API token can access. Worker custom domains require an active zone in this account — check the token's Zone:Read permission, or pin a zone id on the site.`
      )
    }

    return winner.id
  }

  /** Call the Cloudflare API and unwrap its `{ success, result, errors }` envelope. */
  private async cf<T>(    path: string,
    init: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const { apiToken } = await this.requireCredentials()
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
    })

    const text = await response.text()
    let payload: CloudflareEnvelope<T> = {}
    try {
      payload = text ? (JSON.parse(text) as CloudflareEnvelope<T>) : {}
    } catch {
      throw new SitesConfigError(
        `Cloudflare API returned a non-JSON response (${response.status}): ${text.slice(0, 200)}`
      )
    }

    if (!response.ok || payload.success === false) {
      const detail = (payload.errors ?? [])
        .map((error) => error.message || `code ${error.code ?? 'unknown'}`)
        .join('; ')
      throw new SitesConfigError(
        `Cloudflare API ${init.method ?? 'GET'} ${path} failed (${response.status})${detail ? `: ${detail}` : ''}${this.tokenHint(path, detail)}`
      )
    }

    return payload.result as T
  }

  /**
   * The Workers Builds API rejects account-scoped tokens with a terse
   * "Invalid token", which is easy to misread as a wrong token. Add the
   * actual requirement so the operator is not sent down the wrong path.
   */
  private tokenHint(path: string, detail: string): string {
    if (!path.includes('/builds/')) return ''
    if (!/invalid token|unauthor|forbidden|authentication/i.test(detail)) return ''
    return ' — the Workers Builds API requires a user-scoped API token with "Workers Builds Configuration: Edit" (account-scoped tokens are not supported)'
  }

  // -- registry -------------------------------------------------------------

  async list(): Promise<Site[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM sites ORDER BY name ASC')
      .all()
    return (results ?? []).map((row) => rowToSite(row as Record<string, unknown>))
  }

  async listActive(): Promise<Site[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM sites WHERE is_active = 1 ORDER BY name ASC')
      .all()
    return (results ?? []).map((row) => rowToSite(row as Record<string, unknown>))
  }

  /** Look a site up by id or slug. */
  async get(idOrSlug: string): Promise<Site | null> {
    const row = await this.db
      .prepare('SELECT * FROM sites WHERE id = ? OR slug = ? LIMIT 1')
      .bind(idOrSlug, idOrSlug)
      .first()
    return row ? rowToSite(row as Record<string, unknown>) : null
  }

  async create(input: SiteInput): Promise<Site> {
    const slug = normalizeSiteSlug(input.slug || input.name)
    if (!slug) throw new SitesConfigError('A site slug is required')
    if (!input.name?.trim()) throw new SitesConfigError('A site name is required')

    const existing = await this.db
      .prepare('SELECT id FROM sites WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first()
    if (existing) throw new SitesConfigError(`A site with the slug "${slug}" already exists`)

    const id = crypto.randomUUID()
    const now = Date.now()

    await this.db
      .prepare(
        `INSERT INTO sites (
           id, slug, name, description, provider, cf_project_name,
           cf_worker_tag, cf_trigger_uuid, cf_zone_id,
           git_repo, git_branch,
           deploy_hook_url, build_command, deploy_command, output_dir, root_dir, node_version,
           content_prefix, is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        slug,
        input.name.trim(),
        input.description ?? null,
        input.provider ?? 'cloudflare-pages',
        input.cfProjectName ?? null,
        input.cfWorkerTag ?? null,
        input.cfTriggerUuid ?? null,
        input.cfZoneId ?? null,
        input.gitRepo ?? null,
        input.gitBranch ?? 'main',
        input.deployHookUrl ?? null,
        input.buildCommand ?? null,
        input.deployCommand ?? null,
        input.outputDir ?? null,
        input.rootDir ?? null,
        input.nodeVersion ?? null,
        input.contentPrefix ?? null,
        input.isActive === false ? 0 : 1,
        now,
        now
      )
      .run()

    const created = await this.get(id)
    if (!created) throw new Error('Site was created but could not be read back')
    return created
  }

  async update(id: string, input: Partial<SiteInput>): Promise<Site> {
    const current = await this.get(id)
    if (!current) throw new SitesConfigError('Site not found')

    if (input.slug !== undefined) {
      const slug = normalizeSiteSlug(input.slug)
      if (!slug) throw new SitesConfigError('A site slug is required')
      const clash = await this.db
        .prepare('SELECT id FROM sites WHERE slug = ? AND id != ? LIMIT 1')
        .bind(slug, current.id)
        .first()
      if (clash) throw new SitesConfigError(`A site with the slug "${slug}" already exists`)
    }

    const columns: Record<keyof SiteInput, string> = {
      slug: 'slug',
      name: 'name',
      description: 'description',
      provider: 'provider',
      cfProjectName: 'cf_project_name',
      cfWorkerTag: 'cf_worker_tag',
      cfTriggerUuid: 'cf_trigger_uuid',
      cfZoneId: 'cf_zone_id',
      gitRepo: 'git_repo',
      gitBranch: 'git_branch',
      deployHookUrl: 'deploy_hook_url',
      buildCommand: 'build_command',
      deployCommand: 'deploy_command',
      outputDir: 'output_dir',
      rootDir: 'root_dir',
      nodeVersion: 'node_version',
      contentPrefix: 'content_prefix',
      isActive: 'is_active'
    }

    const assignments: string[] = []
    const values: unknown[] = []

    for (const [key, column] of Object.entries(columns)) {
      const value = (input as Record<string, unknown>)[key]
      if (value === undefined) continue
      assignments.push(`${column} = ?`)
      if (key === 'slug') values.push(normalizeSiteSlug(String(value)))
      else if (key === 'isActive') values.push(value ? 1 : 0)
      else values.push(value)
    }

    if (assignments.length === 0) return current

    assignments.push('updated_at = ?')
    values.push(Date.now(), current.id)

    await this.db
      .prepare(`UPDATE sites SET ${assignments.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    const updated = await this.get(current.id)
    if (!updated) throw new Error('Site was updated but could not be read back')
    return updated
  }

  /** Delete a site, its domain rows, and (optionally) its Pages domains. */
  async remove(id: string, options: { removeCloudflareDomains?: boolean } = {}): Promise<void> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')

    if (options.removeCloudflareDomains && site.cfProjectName) {
      const domains = await this.listDomains(site.id)
      for (const domain of domains) {
        if (domain.status === 'removed') continue
        try {
          await this.removeDomain(site.id, domain.hostname)
        } catch (error) {
          // Keep going: a domain already gone from Cloudflare must not block
          // deleting the registry entry.
          console.warn(`[sites] could not remove domain ${domain.hostname}:`, error)
        }
      }
    }

    // Deleting the site cascades to site_domains (ON DELETE CASCADE), but D1
    // does not enforce foreign keys by default — clean up explicitly.
    await this.db.prepare('DELETE FROM site_domains WHERE site_id = ?').bind(site.id).run()
    await this.db.prepare('DELETE FROM sites WHERE id = ?').bind(site.id).run()
  }

  // -- builds ---------------------------------------------------------------

  /**
   * Rebuild a site by POSTing its Cloudflare Pages Deploy Hook.
   *
   * Deploy hooks need no authentication (the URL is the capability), and Pages
   * returns 200 with `{ id, url }` describing the queued deployment.
   */
  async triggerBuild(id: string): Promise<BuildTriggerResult> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')

    if (!site.isActive) {
      throw new SitesConfigError(`Site "${site.slug}" is inactive; enable it before building`)
    }

    const hookUrl = site.deployHookUrl
    if (!hookUrl) {
      throw new SitesConfigError(
        `Site "${site.slug}" has no Deploy Hook URL. Create one in Cloudflare Pages → Settings → Builds & deployments and paste it into the site.`
      )
    }

    let parsed: URL
    try {
      parsed = new URL(hookUrl)
    } catch {
      throw new SitesConfigError('The stored Deploy Hook URL is not a valid URL')
    }
    if (parsed.protocol !== 'https:') {
      throw new SitesConfigError('The Deploy Hook URL must use https')
    }

    // Catch the easy mistake of pasting the wrong provider's hook: the paths
    // differ (`/pages/webhooks/deploy_hooks/…` vs `/workers/builds/deploy_hooks/…`)
    // and a mismatch fails silently at Cloudflare, never returning a build.
    const isWorker = site.provider === 'cloudflare-worker'
    const looksLikePagesHook = parsed.pathname.includes('/pages/')
    const looksLikeWorkersHook = parsed.pathname.includes('/workers/builds/')
    if (isWorker && looksLikePagesHook) {
      throw new SitesConfigError(
        'This site is hosted on a Worker, but the stored URL is a Pages Deploy Hook. Create a Deploy Hook under Worker → Settings → Builds → Deploy Hooks.'
      )
    }
    if (!isWorker && looksLikeWorkersHook) {
      throw new SitesConfigError(
        'This site is hosted on Cloudflare Pages, but the stored URL is a Workers Builds Deploy Hook. Create a Deploy Hook under Pages project → Settings → Builds.'
      )
    }

    const triggeredAt = Date.now()

    let response: Response
    try {
      response = await fetch(hookUrl, { method: 'POST' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deploy hook request failed'
      await this.recordBuild(site.id, { status: 'failed', error: message, at: triggeredAt })
      return { ok: false, siteId: site.id, triggeredAt, error: message }
    }

    const body = await response.text()

    if (!response.ok) {
      const message = `Deploy hook responded ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
      await this.recordBuild(site.id, { status: 'failed', error: message, at: triggeredAt })
      return { ok: false, siteId: site.id, triggeredAt, error: message }
    }

    const parsedBuild = this.parseDeployHookResponse(body, site.provider)

    // Workers Builds de-duplicates: if a build is already queued or
    // initializing, the same build is returned with `already_exists: true`
    // instead of creating another. That is a success, not a conflict.
    await this.recordBuild(site.id, {
      status: 'queued',
      at: triggeredAt,
      buildId: parsedBuild.buildId ?? null,
      buildUrl: parsedBuild.buildUrl ?? null
    })

    return {
      ok: true,
      siteId: site.id,
      triggeredAt,
      ...(parsedBuild.buildId === undefined ? {} : { buildId: parsedBuild.buildId }),
      ...(parsedBuild.buildUrl === undefined ? {} : { buildUrl: parsedBuild.buildUrl }),
      ...(parsedBuild.alreadyExists === undefined
        ? {}
        : { alreadyExists: parsedBuild.alreadyExists })
    }
  }

  /**
   * Deploy Hook responses differ per provider:
   *   * Pages   → `{ id, url }`
   *   * Workers → `{ success, result: { build_uuid, branch, worker, already_exists? } }`
   * A non-JSON body still means "queued" for both.
   */
  private parseDeployHookResponse(
    body: string,
    provider: SiteProvider
  ): { buildId?: string; buildUrl?: string; alreadyExists?: boolean } {
    if (!body) return {}

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(body) as Record<string, unknown>
    } catch {
      return {}
    }

    if (provider === 'cloudflare-worker') {
      const result = (payload.result ?? {}) as Record<string, unknown>
      const buildId = result.build_uuid ? String(result.build_uuid) : undefined
      const alreadyExists =
        result.already_exists === true || payload.already_exists === true ? true : undefined
      return {
        ...(buildId === undefined ? {} : { buildId }),
        ...(alreadyExists === undefined ? {} : { alreadyExists })
      }
    }

    return {
      ...(payload.id === undefined ? {} : { buildId: String(payload.id) }),
      ...(payload.url === undefined ? {} : { buildUrl: String(payload.url) })
    }
  }

  /** Record the outcome of the most recent build trigger. */
  private async recordBuild(
    siteId: string,
    input: {
      status: string
      at: number
      error?: string
      buildId?: string | null
      buildUrl?: string | null
    }
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sites
            SET last_build_at = ?, last_build_status = ?, last_build_error = ?,
                last_build_id = COALESCE(?, last_build_id),
                last_build_url = COALESCE(?, last_build_url),
                updated_at = ?
          WHERE id = ?`
      )
      .bind(
        input.at,
        input.status,
        input.error ?? null,
        input.buildId ?? null,
        input.buildUrl ?? null,
        Date.now(),
        siteId
      )
      .run()
  }

  /** Latest builds/deployments for a site (newest first). */
  async listDeployments(id: string, limit = 5): Promise<SiteDeploymentInfo[]> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')
    const target = this.requireTarget(site)

    if (site.provider === 'cloudflare-worker') {
      // Workers Builds: builds are addressed through the Worker's tag.
      const tag = await this.resolveWorkerTag(site)
      const { accountId } = await this.requireCredentials()
      const result = await this.cf<
        Array<Record<string, unknown>> | { builds?: Array<Record<string, unknown>> }
      >(`/accounts/${accountId}/builds/workers/${tag}/builds`)

      // Depending on the endpoint version the payload is either an array or
      // an object with a `builds` key.
      const list = Array.isArray(result) ? result : result?.builds ?? []

      return list.slice(0, limit).map((build) => ({
        id: String(build.build_uuid ?? ''),
        // Workers Builds exposes logs rather than a preview URL.
        url: build.build_uuid
          ? `https://dash.cloudflare.com/?to=/:account/workers/services/view/${encodeURIComponent(target)}/builds/${encodeURIComponent(String(build.build_uuid))}`
          : null,
        environment: null,
        stage: (build.build_trigger_source as string | null) ?? null,
        status: (build.status as string | null) ?? null,
        createdAt: (build.created_at as string | null) ?? (build.created_on as string | null) ?? null
      }))
    }

    const { accountId } = await this.requireCredentials()
    const result = await this.cf<Array<Record<string, unknown>>>(
      `/accounts/${accountId}/pages/projects/${target}/deployments?per_page=${limit}`
    )

    return (result ?? []).map((deployment) => {
      const latestStage = deployment.latest_stage as Record<string, unknown> | undefined
      const stages = deployment.stages as Array<Record<string, unknown>> | undefined
      const failed = (stages ?? []).find((stage) => stage.status === 'failure')
      const status =
        (latestStage?.status as string | undefined) ??
        (failed ? 'failure' : undefined) ??
        null

      return {
        id: String(deployment.id ?? ''),
        url: (deployment.url as string | null) ?? null,
        environment: (deployment.environment as string | null) ?? null,
        stage: (latestStage?.name as string | null) ?? null,
        status,
        createdAt: (deployment.created_on as string | null) ?? null
      }
    })
  }

  // -- build configuration --------------------------------------------------

  /**
   * Mirror the site's build settings onto its hosting target.
   *
   *  * Pages   → `PATCH /pages/projects/{p}` with `build_config`.
   *  * Workers → `PATCH /builds/triggers/{uuid}` with `build_command`,
   *    `deploy_command` and `root_directory` (the assets directory itself lives
   *    in the repository's Wrangler configuration, not here).
   */
  async syncBuildConfig(id: string): Promise<Site> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')
    const target = this.requireTarget(site)
    const { accountId } = await this.requireCredentials()

    if (site.provider === 'cloudflare-worker') {
      const body: Record<string, string> = {}
      if (site.buildCommand) body.build_command = site.buildCommand
      if (site.deployCommand) body.deploy_command = site.deployCommand
      if (site.rootDir) body.root_directory = site.rootDir

      if (Object.keys(body).length === 0) {
        throw new SitesConfigError(
          'Nothing to sync: set at least a build command, deploy command or root directory'
        )
      }

      const triggerUuid = await this.resolveProductionTrigger(site)
      await this.cf(`/accounts/${accountId}/builds/triggers/${triggerUuid}`, {
        method: 'PATCH',
        body
      })
    } else {
      const buildConfig: Record<string, string> = {}
      if (site.buildCommand) buildConfig.build_command = site.buildCommand
      if (site.outputDir) buildConfig.destination_dir = site.outputDir
      if (site.rootDir) buildConfig.root_dir = site.rootDir

      if (Object.keys(buildConfig).length === 0) {
        throw new SitesConfigError(
          'Nothing to sync: set at least a build command, output directory or root directory'
        )
      }

      await this.cf(`/accounts/${accountId}/pages/projects/${target}`, {
        method: 'PATCH',
        body: { build_config: buildConfig }
      })
    }

    await this.db
      .prepare('UPDATE sites SET build_config_synced_at = ?, updated_at = ? WHERE id = ?')
      .bind(Date.now(), Date.now(), site.id)
      .run()

    const updated = await this.get(site.id)
    if (!updated) throw new Error('Site was updated but could not be read back')
    return updated
  }

  // -- domains --------------------------------------------------------------

  async listDomains(siteId: string): Promise<SiteDomain[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM site_domains WHERE site_id = ? ORDER BY is_primary DESC, hostname ASC')
      .bind(siteId)
      .all()
    return (results ?? []).map((row) => rowToDomain(row as Record<string, unknown>))
  }

  /**
   * Attach a custom domain to the site's hosting target.
   *
   *  * Pages   → `POST /pages/projects/{p}/domains`; the operator must point DNS
   *    at the project, so the binding starts as `pending`.
   *  * Workers → `PUT /workers/domains`; Cloudflare creates the DNS record and
   *    issues the certificate itself, so a successful bind is already `active`.
   *    This also means the hostname must sit inside a zone the token can see.
   */
  async addDomain(siteId: string, rawHostname: string): Promise<SiteDomain> {
    const site = await this.get(siteId)
    if (!site) throw new SitesConfigError('Site not found')
    const target = this.requireTarget(site)

    const hostname = normalizeHostname(rawHostname)
    if (!isHostname(hostname)) {
      throw new SitesConfigError(`"${rawHostname}" is not a valid hostname`)
    }

    const existing = await this.db
      .prepare('SELECT id, status FROM site_domains WHERE site_id = ? AND hostname = ? LIMIT 1')
      .bind(site.id, hostname)
      .first()
    if (existing && (existing as { status?: string }).status !== 'removed') {
      throw new SitesConfigError(`"${hostname}" is already bound to this site`)
    }

    const { accountId } = await this.requireCredentials()

    let status: SiteDomainStatus
    let cfDomainId: string | null
    let zoneId: string | null = null
    let validationStatus: string | null = null
    let validationErrors: string | null = null

    if (site.provider === 'cloudflare-worker') {
      zoneId = await this.resolveZoneId(site, hostname)
      const payload = (await this.cf<Record<string, unknown>>(
        `/accounts/${accountId}/workers/domains`,
        {
          method: 'PUT',
          body: {
            environment: 'production',
            hostname,
            service: target,
            zone_id: zoneId
          }
        }
      )) ?? {}

      cfDomainId = (payload.id as string | null) ?? null
      // No operator-side DNS step, so a created Worker domain is live.
      status = 'active'
    } else {
      const payload = (await this.cf<Record<string, unknown>>(
        `/accounts/${accountId}/pages/projects/${target}/domains`,
        { method: 'POST', body: { name: hostname } }
      )) ?? {}

      const validation = payload.validation_data as Record<string, unknown> | undefined
      cfDomainId = (payload.id as string | null) ?? null
      status = mapCloudflareDomainStatus(payload)
      validationStatus = (validation?.status as string | null) ?? null
      validationErrors = (validation?.error_message as string | null) ?? null
    }

    const now = Date.now()
    const id = existing ? String((existing as { id: string }).id) : crypto.randomUUID()

    if (existing) {
      await this.db
        .prepare(
          `UPDATE site_domains
              SET status = ?, cf_domain_id = ?, cf_zone_id = ?, validation_status = ?, validation_errors = ?, updated_at = ?
            WHERE id = ?`
        )
        .bind(status, cfDomainId, zoneId, validationStatus, validationErrors, now, id)
        .run()
    } else {
      await this.db
        .prepare(
          `INSERT INTO site_domains
             (id, site_id, hostname, status, cf_domain_id, cf_zone_id, validation_status, validation_errors, is_primary, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
        )
        .bind(
          id,
          site.id,
          hostname,
          status,
          cfDomainId,
          zoneId,
          validationStatus,
          validationErrors,
          now,
          now
        )
        .run()
    }

    const row = await this.db
      .prepare('SELECT * FROM site_domains WHERE id = ? LIMIT 1')
      .bind(id)
      .first()
    if (!row) throw new Error('Domain was saved but could not be read back')
    return rowToDomain(row as Record<string, unknown>)
  }

  /** Detach a custom domain from the hosting target and mark the row removed. */
  async removeDomain(siteId: string, rawHostname: string): Promise<void> {
    const site = await this.get(siteId)
    if (!site) throw new SitesConfigError('Site not found')
    const target = this.requireTarget(site)

    const hostname = normalizeHostname(rawHostname)
    const { accountId } = await this.requireCredentials()

    try {
      if (site.provider === 'cloudflare-worker') {
        // The Workers domains API deletes by domain id, so look it up first
        // (the row may not carry one if it was adopted from the dashboard).
        const row = await this.db
          .prepare('SELECT cf_domain_id FROM site_domains WHERE site_id = ? AND hostname = ? LIMIT 1')
          .bind(site.id, hostname)
          .first()
        let domainId = (row as { cf_domain_id?: string | null } | null)?.cf_domain_id ?? null

        if (!domainId) {
          const all = await this.cf<Array<Record<string, unknown>>>(
            `/accounts/${accountId}/workers/domains`
          )
          const match = (all ?? []).find(
            (entry) =>
              String(entry.hostname ?? '').toLowerCase() === hostname &&
              String(entry.service ?? '') === target
          )
          domainId = match?.id ? String(match.id) : null
        }

        if (domainId) {
          await this.cf(`/accounts/${accountId}/workers/domains/${domainId}`, { method: 'DELETE' })
        }
      } else {
        await this.cf(
          `/accounts/${accountId}/pages/projects/${target}/domains/${encodeURIComponent(hostname)}`,
          { method: 'DELETE' }
        )
      }
    } catch (error) {
      // A domain already absent from Cloudflare should still be cleaned up
      // locally, otherwise the registry can never converge.
      const message = error instanceof Error ? error.message : String(error)
      if (!/404|not found/i.test(message)) throw error
    }

    await this.db
      .prepare(
        `UPDATE site_domains SET status = 'removed', is_primary = 0, updated_at = ? 
          WHERE site_id = ? AND hostname = ?`
      )
      .bind(Date.now(), site.id, hostname)
      .run()
  }

  /**
   * Pull the authoritative domain list from Cloudflare and reconcile local rows.
   *
   * This is a read-only operation, so it is safe to offer as a "refresh" action
   * even when the operator is unsure about DNS state.
   */
  async refreshDomains(siteId: string): Promise<SiteDomain[]> {
    const site = await this.get(siteId)
    if (!site) throw new SitesConfigError('Site not found')
    const target = this.requireTarget(site)
    const { accountId } = await this.requireCredentials()

    // Normalise both providers into { hostname, id, status, validation }.
    const remote: Array<{
      hostname: string
      id: string | null
      status: SiteDomainStatus
      validationStatus: string | null
      validationErrors: string | null
    }> = []

    if (site.provider === 'cloudflare-worker') {
      const all = await this.cf<Array<Record<string, unknown>>>(
        `/accounts/${accountId}/workers/domains`
      )
      for (const entry of all ?? []) {
        // The endpoint lists account-wide domains, so filter to this Worker.
        if (String(entry.service ?? '') !== target) continue
        remote.push({
          hostname: normalizeHostname(String(entry.hostname ?? '')),
          id: entry.id ? String(entry.id) : null,
          // Workers domains have no validation step: present means bound.
          status: 'active',
          validationStatus: null,
          validationErrors: (entry.error as string | null) ?? null
        })
      }
    } else {
      const list = await this.cf<Array<Record<string, unknown>>>(
        `/accounts/${accountId}/pages/projects/${target}/domains`
      )
      for (const entry of list ?? []) {
        const validation = entry.validation_data as Record<string, unknown> | undefined
        remote.push({
          hostname: normalizeHostname(String(entry.name ?? '')),
          id: entry.id ? String(entry.id) : null,
          status: mapCloudflareDomainStatus(entry),
          validationStatus: (validation?.status as string | null) ?? null,
          validationErrors: (validation?.error_message as string | null) ?? null
        })
      }
    }

    const now = Date.now()
    const seen = new Set<string>()

    for (const entry of remote) {
      if (!entry.hostname) continue
      seen.add(entry.hostname)

      const existing = await this.db
        .prepare('SELECT id FROM site_domains WHERE site_id = ? AND hostname = ? LIMIT 1')
        .bind(site.id, entry.hostname)
        .first()

      if (existing) {
        await this.db
          .prepare(
            `UPDATE site_domains
                SET status = ?, cf_domain_id = ?, validation_status = ?, validation_errors = ?, updated_at = ?
              WHERE id = ?`
          )
          .bind(
            entry.status,
            entry.id,
            entry.validationStatus,
            entry.validationErrors,
            now,
            (existing as { id: string }).id
          )
          .run()
      } else {
        // Present in Cloudflare but unknown locally (bound from the dashboard):
        // adopt it so the CMS is again the single source of truth.
        await this.db
          .prepare(
            `INSERT INTO site_domains
               (id, site_id, hostname, status, cf_domain_id, validation_status, validation_errors, is_primary, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            site.id,
            entry.hostname,
            entry.status,
            entry.id,
            entry.validationStatus,
            entry.validationErrors,
            now,
            now
          )
          .run()
      }
    }

    // Anything local that Cloudflare no longer knows about is gone.
    const local = await this.listDomains(site.id)
    for (const domain of local) {
      if (domain.status === 'removed' || seen.has(domain.hostname)) continue
      await this.db
        .prepare(`UPDATE site_domains SET status = 'removed', is_primary = 0, updated_at = ? WHERE id = ?`)
        .bind(now, domain.id)
        .run()
    }

    return await this.listDomains(site.id)
  }

  /** Mark one active domain as the site's canonical hostname. */
  async setPrimaryDomain(siteId: string, rawHostname: string): Promise<void> {
    const site = await this.get(siteId)
    if (!site) throw new SitesConfigError('Site not found')
    const hostname = normalizeHostname(rawHostname)

    const target = await this.db
      .prepare('SELECT id, status FROM site_domains WHERE site_id = ? AND hostname = ? LIMIT 1')
      .bind(site.id, hostname)
      .first()
    if (!target) throw new SitesConfigError(`"${hostname}" is not bound to this site`)

    const now = Date.now()
    await this.db
      .prepare('UPDATE site_domains SET is_primary = 0, updated_at = ? WHERE site_id = ?')
      .bind(now, site.id)
      .run()
    await this.db
      .prepare('UPDATE site_domains SET is_primary = 1, updated_at = ? WHERE id = ?')
      .bind(now, (target as { id: string }).id)
      .run()
  }

  // -- content ownership ----------------------------------------------------

  /** Number of content rows owned by a site (and how many are shared). */
  async contentCounts(siteId: string): Promise<{ owned: number; shared: number }> {
    const owned = await this.db
      .prepare('SELECT COUNT(*) as count FROM content WHERE site_id = ? AND deleted_at IS NULL')
      .bind(siteId)
      .first()
    const shared = await this.db
      .prepare('SELECT COUNT(*) as count FROM content WHERE site_id IS NULL AND deleted_at IS NULL')
      .first()

    return {
      owned: Number((owned as { count?: number })?.count ?? 0),
      shared: Number((shared as { count?: number })?.count ?? 0)
    }
  }
}

export type { CloudflareCredentials }
