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
import { createApiToken, revokeApiToken } from './api-tokens'
import { getSiteProvider, providerLabel } from './site-providers'
import type { SiteProviderCapabilities } from './site-providers'
import { importablePresets, presetToSiteInput } from './site-presets'
import { dispatchWorkflow, githubDeployStatus, resolveGithubDispatch } from './github-actions'
import type { GithubDeployStatus } from './github-actions'

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
 *    domains API (requires a zone), builds through the Workers Builds API (a
 *    Deploy Hook still works as a fallback), build settings and build-time
 *    environment variables on a Workers Builds trigger. One Worker can serve
 *    many custom domains, which is why this is the preferred provider for a
 *    multi-site deployment.
 *  * `external`          — anything else; the CMS only records it.
 */
export type SiteProvider = 'cloudflare-pages' | 'cloudflare-worker' | 'external'

/** Hosting providers that the CMS can actually drive through the Cloudflare API. */
export const CLOUDFLARE_HOSTING_PROVIDERS: SiteProvider[] = [
  'cloudflare-pages',
  'cloudflare-worker'
]

/**
 * How a site gets built and deployed.
 *
 *  * `workers-builds` — Cloudflare builds it from a Git connection. The CMS
 *    drives the Builds API and pushes the trigger's build environment.
 *  * `github-actions` — the CMS dispatches `.github/workflows/deploy-site.yml`
 *    with the site's build contract. The runner builds and uploads directly, so
 *    Cloudflare needs no Git connection and no Deploy Hook.
 *  * `deploy-hook`    — a stored Deploy Hook URL rebuilds the site (the usual
 *    shape for a Pages project, which builds on Cloudflare's side).
 *  * `direct-upload`  — nothing for the CMS to trigger: the operator builds and
 *    uploads (`wrangler deploy` / `wrangler pages deploy`).
 */
export type SiteDeployMode =
  | 'workers-builds'
  | 'github-actions'
  | 'deploy-hook'
  | 'direct-upload'

export const SITE_DEPLOY_MODES: SiteDeployMode[] = [
  'workers-builds',
  'github-actions',
  'deploy-hook',
  'direct-upload'
]

/** The mode a provider uses when the site does not pin one. */
export const defaultDeployMode = (provider: SiteProvider): SiteDeployMode => {
  if (provider === 'cloudflare-worker') return 'workers-builds'
  if (provider === 'cloudflare-pages') return 'deploy-hook'
  return 'direct-upload'
}

/**
 * Coerce a stored/submitted value into a deploy mode, or null for "provider
 * default". Anything unrecognised — an empty string from a form whose select was
 * left on the default, a value from an older/newer schema — becomes null rather
 * than being stored and then mis-resolved at build time.
 */
export const normalizeDeployMode = (value: unknown): SiteDeployMode | null => {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  return (SITE_DEPLOY_MODES as string[]).includes(candidate)
    ? (candidate as SiteDeployMode)
    : null
}

/** Human label for a deploy mode, for the admin UI and messages. */
export const deployModeLabel = (mode: SiteDeployMode): string => {
  switch (mode) {
    case 'workers-builds':
      return 'Cloudflare Workers Builds (Git-connected)'
    case 'github-actions':
      return 'GitHub Actions (CMS-dispatched, no Git connection in Cloudflare)'
    case 'deploy-hook':
      return 'Cloudflare Deploy Hook'
    case 'direct-upload':
      return 'Manual direct upload'
  }
}

/** A Worker trigger's `root_directory` uses `/` for the repo root; a shell wants `.`. */
export const normalizeRootDirectory = (value: string | null | undefined): string => {
  const raw = (value ?? '').trim()
  return raw === '' || raw === '/' || raw === './' ? '.' : raw
}

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

/**
 * How a site publishes content: collection name -> the path prefix that
 * collection is published under **on that site** (`''` is that host's root).
 *
 * `null` means an "app site": it publishes the website's own routes plus every
 * routed collection at the collection's own `url_prefix`. An object means a
 * "content-only site" that publishes **only** the listed collections. See
 * migration 043 and `services/site-routing.ts` for the contract.
 */
export type SiteContentRoutes = Record<string, string>

/**
 * What the admin API and forms may submit for `content_routes`: an object, a
 * JSON string, or null/empty for "this site builds the whole website".
 */
export type SiteContentRoutesInput = SiteContentRoutes | string | null

/** How a site publishes: at its own path prefixes, or as a host of its own. */
export type SiteContentMode = 'paths' | 'standalone'

export const SITE_CONTENT_MODES: SiteContentMode[] = ['paths', 'standalone']

export const normalizeContentMode = (value: unknown): SiteContentMode | null => {
  const candidate = typeof value === 'string' ? value.trim() : ''
  return (SITE_CONTENT_MODES as string[]).includes(candidate)
    ? (candidate as SiteContentMode)
    : null
}

export interface Site {
  id: string
  slug: string
  name: string
  description: string | null
  provider: SiteProvider
  /** Null means "use the provider default" — see {@link defaultDeployMode}. */
  deployMode: SiteDeployMode | null
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
  /**
   * Which collections this site publishes, and under which prefix on this host
   * (migration 043). `null` means "app site" — the website's own routes plus
   * every collection at its own `url_prefix`.
   */
  contentRoutes: SiteContentRoutes | null

  /**
   * `standalone` is deployed on its own: it publishes the website when it declares
   * no content routes, or just the collections its routes name when it does.
   * `paths` is not deployed — the site in {@link parentSiteId} publishes its
   * content under the prefixes its routes name.
   */
  contentMode: SiteContentMode | null

  /**
   * The site a `paths` site is mounted on (migration 052): its content is published
   * by that site, at the prefixes this site's content routes name. Always an active
   * `standalone` site; null on a site that is deployed on its own.
   */
  parentSiteId: string | null
  /** Extra/overriding build-time env vars pushed to the trigger (migration 040). */
  buildEnv: Record<string, SiteBuildEnvVar>
  /** Read-only API token the CMS minted for this site's builds (never serialized). */
  contentToken: string | null
  /** `api_tokens` row backing `contentToken`, so it can be rotated or revoked. */
  contentTokenId: string | null
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
  deployMode?: SiteDeployMode | null
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
  /**
   * Collections this site publishes (see {@link SiteContentRoutes}). Accepts an
   * object, a JSON string (what the admin textarea sends) or null for "app
   * site". Omitted on update means "leave the stored value alone".
   */
  contentRoutes?: SiteContentRoutesInput

  /** How the site publishes; see {@link SiteContentMode}. */
  contentMode?: SiteContentMode | null
  /**
   * The site this one is mounted on; required by `paths` and rejected with a
   * `standalone` target that does not exist. `null` clears it.
   */
  parentSiteId?: string | null
  buildEnv?: Record<string, SiteBuildEnvVar> | null
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
  /** How the build was started. */
  via?: 'api' | 'hook' | 'github-actions'
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

/** One build-time environment variable pushed to a Workers Builds trigger. */
export interface SiteBuildEnvVar {
  value: string
  /** Secrets are masked in Cloudflare's build logs. */
  secret?: boolean
}

/** Outcome of pushing a site's build settings, including its environment. */
export interface SyncBuildConfigResult {
  site: Site
  /** True when the trigger's environment variables were updated. */
  envPushed: boolean
  /** Environment variable keys that were pushed. */
  envKeys: string[]
  /** Operator-facing notes (what was skipped and why). */
  notes: string[]
}

/** Outcome of importing the Arwes site presets. */
export interface SitePresetImportResult {
  created: Array<{ slug: string; name: string; provider: SiteProvider }>
  skipped: Array<{ slug: string; reason: string }>
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

/**
 * Build env is stored as JSON. A malformed value must not break the whole site
 * row — the admin page still has to render so the operator can fix it.
 */
const parseBuildEnv = (raw: unknown): Record<string, SiteBuildEnvVar> => {
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, SiteBuildEnvVar> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      if (value && typeof value === 'object' && 'value' in value) {
        const entry = value as { value?: unknown; secret?: unknown }
        out[key] = { value: String(entry.value ?? ''), secret: entry.secret === true }
      } else if (typeof value === 'string') {
        out[key] = { value, secret: false }
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Normalise one content-route prefix the way the collections API normalises
 * `url_prefix`: `''` (or `'/'`) means that host's root, anything else gets a
 * leading slash and loses its trailing one. A multi-segment prefix
 * (`'/blog/2026'`) is kept as-is.
 */
export const normalizeContentPrefix = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '/') return ''
  return (trimmed.startsWith('/') ? trimmed : `/${trimmed}`).replace(/\/+$/, '')
}

/**
 * Lenient read of the stored `content_routes` column.
 *
 * A malformed value must not break the whole site row — the admin page still has
 * to render so an operator can fix it — so anything unparseable is read as
 * `null` ("app site"), exactly like {@link parseBuildEnv} degrades to `{}`.
 */
export const parseSiteContentRoutes = (raw: unknown): SiteContentRoutes | null => {
  if (raw === null || raw === undefined) return null

  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const out: SiteContentRoutes = {}
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    // Values are path prefixes; a non-string (a number, an object) is ignored
    // rather than coerced, so a bad row degrades instead of inventing a path.
    if (typeof value !== 'string') continue
    const key = name.trim()
    if (key === '') continue
    out[key] = normalizeContentPrefix(value)
  }

  return Object.keys(out).length > 0 ? out : null
}

/**
 * Strict read of a `content_routes` value submitted by the API or the admin form.
 *
 * Accepts an object, a JSON string or null/empty (all-empty means "app site", so
 * clearing the textarea restores the historical behaviour). Anything malformed
 * throws {@link SitesConfigError} so the caller answers 400 instead of storing a
 * value a build would later misread.
 */
export const readContentRoutesInput = (raw: unknown): SiteContentRoutes | null => {
  if (raw === null || raw === undefined) return null

  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new SitesConfigError(
        `Content routes must be valid JSON, for example {"blog-posts": ""}`
      )
    }
  }

  // A JSON string of "null" explicitly means "app site".
  if (parsed === null) return null

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SitesConfigError(
      `Content routes must be a JSON object mapping collection name to path prefix, for example {"blog-posts": ""}`
    )
  }

  const out: SiteContentRoutes = {}
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    const key = name.trim()
    if (key === '') {
      throw new SitesConfigError('Content routes must not contain an empty collection name')
    }
    if (typeof value !== 'string') {
      throw new SitesConfigError(
        `The content route for "${key}" must be a string path prefix (use "" for that host's root)`
      )
    }
    if (value.includes('://')) {
      throw new SitesConfigError(
        `The content route for "${key}" must be a path prefix, not a URL (the host comes from the site's domain)`
      )
    }
    // `''` or `'/'` is that host's root; a missing leading slash is added, so
    // "blog" and "/blog" store the same value.
    out[key] = normalizeContentPrefix(value)
  }

  // An empty object would describe a content-only site that publishes nothing,
  // which is never what an operator means — empty means "build the website".
  return Object.keys(out).length > 0 ? out : null
}

const rowToSite = (row: Record<string, unknown>): Site => ({
  id: String(row.id),
  slug: String(row.slug),
  name: String(row.name),
  description: (row.description as string | null) ?? null,
  provider: ((row.provider as string) || 'cloudflare-pages') as SiteProvider,
  deployMode: normalizeDeployMode(row.deploy_mode),
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
  contentRoutes: parseSiteContentRoutes(row.content_routes),
  contentMode: normalizeContentMode(row.content_mode),
  parentSiteId: (row.parent_site_id as string | null) ?? null,
  buildEnv: parseBuildEnv(row.build_env),
  contentToken: (row.content_token as string | null) ?? null,
  contentTokenId: (row.content_token_id as string | null) ?? null,
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

/**
 * The build-time environment for a site.
 *
 * Pure, and exported so the admin UI can render exactly what a sync would push
 * without constructing a service. The three `PUBLIC_SCIFI_*` values are what the
 * Astro loader in `@sci-fi-cms/astro` reads (`apps/docs/src/content.config.ts`);
 * they are the difference between a build that talks to the production CMS for
 * the right site and one that silently falls back to `http://localhost:8787`.
 * Operator-defined variables on the site win, so any of them can be overridden.
 */
/**
 * Pre-rename build env spellings (`PUBLIC_FLARE_*`). Still read where a value may
 * have been pinned before the rename; never written.
 */
export const LEGACY_BUILD_ENV_KEYS = [
  'PUBLIC_FLARE_API_URL',
  'PUBLIC_FLARE_SITE',
  'PUBLIC_FLARE_API_TOKEN'
]

export const buildSiteEnvironment = (
  site: Site,
  options: { apiBaseUrl?: string | null; contentToken?: string | null } = {}
): Record<string, SiteBuildEnvVar> => {
  const computed: Record<string, SiteBuildEnvVar> = {}
  if (options.apiBaseUrl) {
    computed.PUBLIC_SCIFI_API_URL = { value: options.apiBaseUrl, secret: false }
  }
  computed.PUBLIC_SCIFI_SITE = { value: site.slug, secret: false }
  const token = options.contentToken ?? site.contentToken
  if (token) computed.PUBLIC_SCIFI_API_TOKEN = { value: token, secret: true }
  // Legacy PUBLIC_FLARE_* pins are dropped instead of being carried onto the
  // trigger, where they would advertise the old variable names. The value is not
  // lost: apiBaseUrlFor() reads a legacy API-URL pin forward into the new key.
  const extras = Object.fromEntries(
    Object.entries(site.buildEnv ?? {}).filter(([key]) => !LEGACY_BUILD_ENV_KEYS.includes(key))
  )
  return { ...computed, ...extras }
}

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
        `Worker "${site.cfProjectName}" has no Workers Builds trigger, so the CMS cannot start a build for it. ` +
          `Two ways forward: connect the Worker to a Git repository in Cloudflare (Worker → Settings → Builds) and create a trigger, ` +
          `or skip Git entirely — build locally and deploy the output with the direct-upload API${this.directUploadHint(site)}, ` +
          `which is what "wrangler deploy" already does. Direct upload needs no trigger; the CMS keeps owning this site's domains and content either way.`
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
   * The local, no-Git deploy command for a site, derived from its deploy command.
   *
   * Cloudflare cannot build this project inside a Worker: Workers Builds is a Git
   * integration, and a Worker has no toolchain or writable filesystem for
   * `astro build`. Without a Git connection the site is built locally and pushed
   * with the Workers direct-upload API — the same flow `wrangler deploy` runs.
   */
  private directUploadHint(site: Site): string {
    const command = (site.deployCommand || '').trim()
    return command ? ` (for example: ${command})` : ''
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

  /**
   * Normalise a submitted `content_routes` value and check that every collection
   * it names is registered.
   *
   * The collection lookup lives here rather than in the routes because it needs
   * the database, and because every write path must store the same resolvable
   * value: a route naming a collection that does not exist would make the site's
   * build silently publish nothing.
   *
   * Returns `undefined` for "leave the stored value alone" (the input omitted the
   * field), `null` for "app site".
   */
  private async resolveContentRoutes(
    value: SiteContentRoutesInput | undefined
  ): Promise<SiteContentRoutes | null | undefined> {
    if (value === undefined) return undefined

    const routes = readContentRoutesInput(value)
    if (routes === null) return null

    const names = Object.keys(routes)
    const placeholders = names.map(() => '?').join(', ')
    const { results } = await this.db
      .prepare(`SELECT name FROM collections WHERE name IN (${placeholders})`)
      .bind(...names)
      .all()

    const known = new Set(
      (results ?? []).map((row) => String((row as { name: unknown }).name))
    )
    const unknown = names.filter((name) => !known.has(name))
    if (unknown.length > 0) {
      const list = unknown.map((name) => `"${name}"`).join(', ')
      throw new SitesConfigError(
        `Unknown collection${unknown.length === 1 ? '' : 's'} in content routes: ${list}. ` +
          `Register ${unknown.length === 1 ? 'it' : 'them'} in Admin → Collections first.`
      )
    }

    return routes
  }

  /**
   * Resolve the site a `paths` site is mounted on (migration 052).
   *
   * The parent publishes the child's content, so it has to be a site that is itself
   * deployed — an active `standalone` site. A `paths` site without a parent would
   * publish nowhere, which is a configuration mistake rather than a state to store,
   * so it is rejected here instead of silently building nothing.
   */
  private async resolveParentSite(
    value: unknown,
    self: { id: string | null; contentMode: SiteContentMode }
  ): Promise<string | null> {
    const requested = typeof value === 'string' ? value.trim() : ''
    if (requested === '') {
      if (self.contentMode === 'paths') {
        throw new SitesConfigError(
          'A site in paths mode needs a parent site (the deployed site that publishes its content)'
        )
      }
      return null
    }

    const row = await this.db
      .prepare('SELECT * FROM sites WHERE slug = ? OR id = ? LIMIT 1')
      .bind(requested, requested)
      .first()
    if (!row) {
      throw new SitesConfigError(`Unknown parent site "${requested}"`)
    }

    const parent = rowToSite(row as Record<string, unknown>)
    if (self.id && parent.id === self.id) {
      throw new SitesConfigError('A site cannot be its own parent')
    }
    if (!parent.isActive) {
      throw new SitesConfigError(`The parent site "${parent.slug}" is inactive`)
    }
    const parentMode = parent.contentMode ?? 'standalone'
    if (parentMode !== 'standalone') {
      throw new SitesConfigError(
        `The parent site "${parent.slug}" publishes in paths mode itself; the parent has to be a standalone site`
      )
    }

    return parent.id
  }

  /** Active sites mounted on this one, which this site publishes. */
  async listChildren(siteId: string): Promise<Site[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM sites WHERE parent_site_id = ? AND is_active = 1 ORDER BY slug ASC')
      .bind(siteId)
      .all()
    return (results ?? []).map((row) => rowToSite(row as Record<string, unknown>))
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

    // Normalised (and checked against `collections.name`) before the INSERT so an
    // unknown collection is a 400, not a stored route no build can resolve.
    const contentRoutes = await this.resolveContentRoutes(input.contentRoutes)
    // Naming a parent makes the site a mounted slice of that parent; without one it
    // is deployed on its own.
    const contentMode =
      normalizeContentMode(input.contentMode) ?? (input.parentSiteId ? 'paths' : 'standalone')
    // A `paths` site is published by its parent, so the parent has to exist and be
    // a site that is deployed itself; checked before the INSERT for the same reason
    // the routes are.
    const parentSiteId = await this.resolveParentSite(input.parentSiteId, {
      id: null,
      contentMode
    })

    await this.db
      .prepare(
        `INSERT INTO sites (
           id, slug, name, description, provider, cf_project_name,
           cf_worker_tag, cf_trigger_uuid, cf_zone_id,
           git_repo, git_branch,
           deploy_hook_url, build_command, deploy_command, output_dir, root_dir, node_version,
           content_prefix, content_routes, content_mode, parent_site_id, build_env, content_token, content_token_id, deploy_mode,
           is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)`
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
        contentRoutes ? JSON.stringify(contentRoutes) : null,
        // The mode follows what the site publishes unless it says otherwise.
        contentMode,
        parentSiteId,
        input.buildEnv && Object.keys(input.buildEnv).length > 0
          ? JSON.stringify(input.buildEnv)
          : null,
        input.deployMode === undefined ? null : normalizeDeployMode(input.deployMode),
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
      deployMode: 'deploy_mode',
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
      contentRoutes: 'content_routes',
      contentMode: 'content_mode',
      parentSiteId: 'parent_site_id',
      buildEnv: 'build_env',
      isActive: 'is_active'
    }

    // The mode and the parent are validated together against the row's resulting
    // state, so switching a site to `paths` without naming a parent is rejected even
    // when only one of the two fields is sent.
    const nextMode = normalizeContentMode(input.contentMode) ?? current.contentMode ?? 'standalone'
    const resolvedParent = await this.resolveParentSite(
      input.parentSiteId !== undefined ? input.parentSiteId : current.parentSiteId,
      { id: current.id, contentMode: nextMode }
    )
    if (resolvedParent !== current.parentSiteId) {
      ;(input as Record<string, unknown>).parentSiteId = resolvedParent
    }

    const assignments: string[] = []
    const values: unknown[] = []

    for (const [key, column] of Object.entries(columns)) {
      const value = (input as Record<string, unknown>)[key]
      if (value === undefined) continue
      assignments.push(`${column} = ?`)
      if (key === 'slug') values.push(normalizeSiteSlug(String(value)))
      else if (key === 'isActive') values.push(value ? 1 : 0)
      else if (key === 'deployMode') values.push(normalizeDeployMode(value))
      else if (key === 'parentSiteId') values.push(value === null ? null : String(value))
      else if (key === 'contentRoutes') {
        const routes = await this.resolveContentRoutes(value as SiteContentRoutesInput)
        values.push(routes === undefined || routes === null ? null : JSON.stringify(routes))
      } else if (key === 'buildEnv')
        values.push(
          value && typeof value === 'object' && Object.keys(value as object).length > 0
            ? JSON.stringify(value)
            : null
        )
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

    // A build token that outlives its site would keep working (degraded to the
    // shared scope), so revoke it together with the site.
    if (site.contentTokenId) {
      await revokeApiToken(this.db, site.contentTokenId).catch((error) =>
        console.warn('[sites] could not revoke the site build token:', error)
      )
    }

    // Deleting the site cascades to site_domains (ON DELETE CASCADE), but D1
    // does not enforce foreign keys by default — clean up explicitly.
    await this.db.prepare('DELETE FROM site_domains WHERE site_id = ?').bind(site.id).run()
    await this.db.prepare('DELETE FROM sites WHERE id = ?').bind(site.id).run()
  }

  // -- builds ---------------------------------------------------------------

  /**
   * Start a build.
   *
   * Worker sites go through the Builds API (see {@link triggerBuildViaApi}) and
   * fall back to a Deploy Hook; Pages sites always use their Deploy Hook, which
   * needs no authentication because the URL is the capability.
   */
  async triggerBuild(
    id: string,
    options: { via?: 'api' | 'hook' } = {}
  ): Promise<BuildTriggerResult> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')

    if (!site.isActive) {
      throw new SitesConfigError(`Site "${site.slug}" is inactive; enable it before building`)
    }

    // A site in paths mode has no host of its own (migration 052): its content is
    // published by its parent, so building it would publish a second copy of the
    // content somewhere it does not belong. Building the parent is what the operator
    // means, so the answer says so.
    if (site.contentMode === 'paths') {
      const parent = site.parentSiteId ? await this.get(site.parentSiteId) : null
      throw new SitesConfigError(
        `Site "${site.slug}" publishes in paths mode: its content is published by ` +
          `"${parent?.slug ?? 'its parent site'}". Build that site instead.`
      )
    }

    const mode = this.effectiveDeployMode(site)

    // A dispatched GitHub Actions workflow is how a site gets built without any
    // Cloudflare-side Git connection: the runner builds and uploads directly.
    if (mode === 'github-actions') {
      return await this.dispatchSiteBuild(site)
    }

    if (mode === 'direct-upload') {
      throw new SitesConfigError(
        `Site "${site.slug}" is set to manual direct upload, so there is no build for the CMS to trigger. ` +
          `Build and upload it yourself${this.directUploadHint(site)}, or pick a deploy mode the CMS can drive: ` +
          `"github-actions" (runs the build in GitHub Actions), "workers-builds" (Cloudflare builds from Git) or "deploy-hook".`
      )
    }

    // A Worker with a Git-connected trigger does not need a Deploy Hook: the
    // Builds API starts the build directly and returns the build uuid.
    if (
      mode === 'workers-builds' &&
      site.provider === 'cloudflare-worker' &&
      this.capabilities(site).triggerBuildViaApi &&
      options.via !== 'hook'
    ) {
      try {
        return await this.triggerBuildViaApi(site)
      } catch (error) {
        // With no hook stored there is nothing to fall back to, so the API
        // error (missing trigger, token scope) is the useful answer.
        if (!site.deployHookUrl) throw error
        console.error('Builds API trigger failed, falling back to the Deploy Hook:', error)
      }
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
      via: 'hook',
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
      // A Worker deployed by direct upload (a dispatched GitHub Actions run, or
      // wrangler from a laptop) has no Workers Builds builds: what actually
      // exists is the Worker's own deployment history. Reading that is the
      // honest answer — asking the Builds API would report a missing trigger.
      if (this.effectiveDeployMode(site) !== 'workers-builds') {
        const { accountId } = await this.requireCredentials()
        const result = await this.cf<
          Array<Record<string, unknown>> | { deployments?: Array<Record<string, unknown>> }
        >(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(target)}/deployments`)

        const deployments = Array.isArray(result) ? result : result?.deployments ?? []
        return deployments.slice(0, limit).map((deployment) => ({
          id: String(deployment.id ?? ''),
          url: `https://dash.cloudflare.com/?to=/:account/workers/services/view/${encodeURIComponent(target)}/production`,
          environment: 'production',
          stage: (deployment.source as string | null) ?? (deployment.strategy as string | null) ?? null,
          // A recorded deployment is the live one; Workers keeps the history.
          status: 'deployed',
          createdAt: (deployment.created_on as string | null) ?? null
        }))
      }

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
  async syncBuildConfig(
    id: string,
    options: {
      apiBaseUrl?: string | null
      pushEnv?: boolean
      rotateToken?: boolean
      ownerUserId?: string
    } = {}
  ): Promise<SyncBuildConfigResult> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')
    const target = this.requireTarget(site)
    const { accountId } = await this.requireCredentials()
    const notes: string[] = []

    if (site.provider === 'cloudflare-worker') {
      const body: Record<string, string> = {}
      if (site.buildCommand) body.build_command = site.buildCommand
      if (site.deployCommand) body.deploy_command = site.deployCommand
      if (site.rootDir) body.root_directory = site.rootDir

      if (Object.keys(body).length > 0) {
        const triggerUuid = await this.resolveProductionTrigger(site)
        await this.cf(`/accounts/${accountId}/builds/triggers/${triggerUuid}`, {
          method: 'PATCH',
          body
        })
        notes.push(`Build settings pushed to trigger ${triggerUuid}.`)
      } else {
        notes.push(
          'No build command, deploy command or root directory set — build settings were left unchanged.'
        )
      }
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
      notes.push('Build settings pushed to the Pages project.')
    }

    await this.db
      .prepare('UPDATE sites SET build_config_synced_at = ?, updated_at = ? WHERE id = ?')
      .bind(Date.now(), Date.now(), site.id)
      .run()

    // Build settings and the build environment belong together: a Worker build
    // that does not know the CMS URL and its site slug quietly builds against
    // http://localhost:8787, so both go out in the same action.
    let envKeys: string[] = []
    let envPushed = false

    if (site.provider === 'cloudflare-worker' && options.pushEnv !== false) {
      const envResult = await this.pushBuildEnvironment(site.id, {
        ...(options.apiBaseUrl === undefined ? {} : { apiBaseUrl: options.apiBaseUrl }),
        ...(options.rotateToken === undefined ? {} : { rotateToken: options.rotateToken }),
        ...(options.ownerUserId === undefined ? {} : { ownerUserId: options.ownerUserId })
      })
      envKeys = envResult.envKeys
      envPushed = true
      notes.push(...envResult.notes)
    } else if (site.provider === 'cloudflare-pages') {
      notes.push(
        'Pages build variables live in the Pages project settings; the CMS does not push them.'
      )
    }

    const updated = await this.get(site.id)
    if (!updated) throw new Error('Site was updated but could not be read back')
    return { site: updated, envPushed, envKeys, notes }
  }

  // -- build environment ----------------------------------------------------

  /**
   * Mint (or rotate) the read-only API token this site's builds use to read its
   * own content.
   *
   * The value is stored on the site row because the token service keeps only a
   * hash: the same value has to be re-pushable on every build-config sync. It is
   * scoped to this site (`api_tokens.site_id`), so it cannot read another site's
   * content even if a build changes `X-Site`.
   */
  async ensureContentToken(
    site: Site,
    options: { ownerUserId?: string; rotate?: boolean } = {}
  ): Promise<string> {
    if (site.contentToken && !options.rotate) return site.contentToken

    if (options.rotate && site.contentTokenId) {
      await revokeApiToken(this.db, site.contentTokenId).catch((error) =>
        console.error('Failed to revoke the previous site build token:', error)
      )
    }

    const ownerUserId = options.ownerUserId ?? (await this.firstAdminUserId())
    const created = await createApiToken(this.db, {
      name: `site:${site.slug}`,
      userId: ownerUserId,
      allowedCollections: null,
      expiresAt: null,
      siteId: site.id
    })

    await this.db
      .prepare(
        'UPDATE sites SET content_token = ?, content_token_id = ?, updated_at = ? WHERE id = ?'
      )
      .bind(created.tokenValue, created.id, Date.now(), site.id)
      .run()

    return created.tokenValue
  }

  /** `api_tokens.user_id` is NOT NULL, so a build token needs an owner. */
  private async firstAdminUserId(): Promise<string> {
    const preferred = await this.db
      .prepare(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`)
      .first()
    const row =
      preferred ?? (await this.db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').first())
    if (!row) {
      throw new SitesConfigError(
        'No user exists to own the site build token; create an admin user first'
      )
    }
    return String((row as { id: string }).id)
  }

  /**
   * The build-time environment for a site.
   *
   * The three `PUBLIC_SCIFI_*` values are what the Astro loader in
   * `@sci-fi-cms/astro` reads (`apps/docs/src/content.config.ts`), and they are
   * the difference between a build that talks to the production CMS for the
   * right site and one that silently falls back to `http://localhost:8787`.
   * Operator-defined variables on the site win, so a site can still override
   * any of them.
   */
  buildEnvironment(
    site: Site,
    options: { apiBaseUrl?: string | null; contentToken?: string | null } = {}
  ): Record<string, SiteBuildEnvVar> {
    return buildSiteEnvironment(site, options)
  }

  /** The deploy mode this site effectively uses (its own value, or the provider default). */
  effectiveDeployMode(site: Site): SiteDeployMode {
    return site.deployMode ?? defaultDeployMode(site.provider)
  }

  /**
   * What the CMS can do for this site: the provider's abilities narrowed by the
   * site's deploy mode, so the UI never offers an action that cannot work.
   */
  capabilities(site: Site): SiteProviderCapabilities {
    const base = getSiteProvider(site.provider).can
    const mode = this.effectiveDeployMode(site)
    return {
      ...base,
      triggerBuild: base.triggerBuild && mode !== 'direct-upload',
      triggerBuildViaApi: base.triggerBuildViaApi && mode === 'workers-builds',
      triggerBuildViaGithubActions:
        base.triggerBuildViaGithubActions && mode === 'github-actions',
      triggerBuildViaHook:
        base.triggerBuildViaHook && mode !== 'direct-upload' && mode !== 'github-actions',
      // Build settings and the trigger's environment only exist on a
      // Git-connected Workers Builds site; a dispatched Action carries its own.
      syncBuildConfig: base.syncBuildConfig && mode === 'workers-builds',
      pushBuildEnv: base.pushBuildEnv && mode === 'workers-builds'
    }
  }

  /** Client-safe view of the GitHub dispatch configuration for this site. */
  async githubStatus(site?: Site): Promise<GithubDeployStatus> {
    return githubDeployStatus(this.env, this.settings, site)
  }

  /**
   * Push a site's build environment to its Workers Builds trigger.
   *
   * Only the `PUBLIC_SCIFI_*` keys (plus operator extras) are sent: the API
   * patches the keys it is given, so variables the operator added in the
   * dashboard are left alone.
   */
  async pushBuildEnvironment(
    id: string,
    options: { apiBaseUrl?: string | null; rotateToken?: boolean; ownerUserId?: string } = {}
  ): Promise<SyncBuildConfigResult> {
    const site = await this.get(id)
    if (!site) throw new SitesConfigError('Site not found')

    if (site.provider !== 'cloudflare-worker') {
      throw new SitesConfigError(
        `Build environment variables can only be pushed to a Worker trigger; "${site.slug}" is ${providerLabel(site.provider)}`
      )
    }

    const contentToken = await this.ensureContentToken(site, {
      ...(options.rotateToken === undefined ? {} : { rotate: options.rotateToken }),
      ...(options.ownerUserId === undefined ? {} : { ownerUserId: options.ownerUserId })
    })

    const env = this.buildEnvironment(site, {
      ...(options.apiBaseUrl === undefined ? {} : { apiBaseUrl: options.apiBaseUrl }),
      contentToken
    })

    const triggerUuid = await this.resolveProductionTrigger(site)
    const { accountId } = await this.requireCredentials()

    const body: Record<string, { value: string; is_secret: boolean }> = {}
    for (const [key, value] of Object.entries(env)) {
      if (value.value === '') continue
      body[key] = { value: value.value, is_secret: value.secret === true }
    }

    if (Object.keys(body).length === 0) {
      throw new SitesConfigError('Nothing to push: the build environment resolved to no variables')
    }

    await this.cf(`/accounts/${accountId}/builds/triggers/${triggerUuid}/environment_variables`, {
      method: 'PATCH',
      body
    })

    const updated = await this.get(site.id)
    if (!updated) throw new Error('Site was updated but could not be read back')

    return {
      site: updated,
      envPushed: true,
      envKeys: Object.keys(body),
      notes: [`Build environment pushed to trigger ${triggerUuid}.`]
    }
  }

  /** Dashboard URL for a Worker build, used when a build is queued. */
  private buildDashboardUrl(site: Site, buildId: string | undefined): string | null {
    if (!buildId || !site.cfProjectName) return null
    return `https://dash.cloudflare.com/?to=/:account/workers/services/view/${encodeURIComponent(site.cfProjectName)}/builds/${encodeURIComponent(buildId)}`
  }

  /**
   * Start a build by dispatching the generic GitHub Actions workflow.
   *
   * The workflow itself is site-agnostic: the CMS sends the site's own build
   * contract as inputs, so the registry stays the single source of truth for how
   * the site is built and where the output is uploaded. That is what lets a site
   * be deployed without any Cloudflare-side Git connection and without a Deploy
   * Hook.
   */
  private async dispatchSiteBuild(site: Site): Promise<BuildTriggerResult> {
    if (site.provider === 'external') {
      throw new SitesConfigError(
        `Site "${site.slug}" is hosted externally; the CMS can only record it`
      )
    }

    const target = await resolveGithubDispatch(this.env, this.settings, site)
    if (!target) {
      throw new SitesConfigError(
        `Site "${site.slug}" deploys through GitHub Actions, but no GitHub token and repository are configured. ` +
          `Save them under Admin → Sites → GitHub deploy, or set the GITHUB_TOKEN and GITHUB_REPO Worker secrets.`
      )
    }

    const buildCommand = (site.buildCommand || '').trim()
    const deployCommand = (site.deployCommand || '').trim()
    if (!buildCommand || !deployCommand) {
      throw new SitesConfigError(
        `Site "${site.slug}" needs both a build command and a deploy command before GitHub Actions can deploy it.`
      )
    }

    const triggeredAt = Date.now()
    const result = await dispatchWorkflow(target, {
      site: site.slug,
      provider: site.provider,
      build_command: buildCommand,
      deploy_command: deployCommand,
      root_directory: normalizeRootDirectory(site.rootDir),
      ref: target.ref,
      // Pages needs the project name so the workflow can create it when missing;
      // a Worker is created by the deploy command itself.
      ...(site.provider === 'cloudflare-pages' && site.cfProjectName
        ? { pages_project: site.cfProjectName }
        : {}),
      ...(site.nodeVersion ? { node_version: site.nodeVersion } : {})
    })

    if (!result.ok) {
      await this.recordBuild(site.id, {
        status: 'failed',
        at: triggeredAt,
        error: result.error ?? 'GitHub Actions dispatch failed'
      })
      return {
        ok: false,
        siteId: site.id,
        triggeredAt,
        via: 'github-actions',
        buildUrl: result.runUrl,
        ...(result.error === undefined ? {} : { error: result.error })
      }
    }

    await this.recordBuild(site.id, {
      status: 'dispatched',
      at: triggeredAt,
      buildUrl: result.runUrl
    })

    return {
      ok: true,
      siteId: site.id,
      triggeredAt,
      via: 'github-actions',
      buildUrl: result.runUrl
    }
  }

  /**
   * Start a Workers Builds build through the Builds API.
   *
   * This is why a Worker site does not need a Deploy Hook: the trigger is
   * addressed directly, the branch to build is explicit, and the API answers
   * with the build uuid the CMS records.
   */
  private async triggerBuildViaApi(site: Site): Promise<BuildTriggerResult> {
    const triggeredAt = Date.now()
    const triggerUuid = await this.resolveProductionTrigger(site)
    const { accountId } = await this.requireCredentials()
    const branch = site.gitBranch || 'main'

    const result = await this.cf<Record<string, unknown>>(
      `/accounts/${accountId}/builds/triggers/${triggerUuid}/builds`,
      { method: 'POST', body: { branch } }
    )

    const buildId = result?.build_uuid ? String(result.build_uuid) : undefined
    const alreadyExists = result?.already_exists === true ? true : undefined

    await this.recordBuild(site.id, {
      status: 'queued',
      at: triggeredAt,
      buildId: buildId ?? null,
      buildUrl: this.buildDashboardUrl(site, buildId)
    })

    return {
      ok: true,
      siteId: site.id,
      triggeredAt,
      via: 'api',
      ...(buildId === undefined ? {} : { buildId }),
      ...(alreadyExists === undefined ? {} : { alreadyExists })
    }
  }

  /**
   * Create every importable Arwes preset that is not registered yet.
   *
   * Existing slugs are reported as skipped instead of overwritten, so this is
   * safe to run repeatedly and never clobbers operator edits.
   */
  async importPresets(): Promise<SitePresetImportResult> {
    const existing = new Set((await this.list()).map((site) => site.slug))
    const created: SitePresetImportResult['created'] = []
    const skipped: SitePresetImportResult['skipped'] = []

    for (const preset of importablePresets()) {
      const slug = normalizeSiteSlug(preset.slug || preset.name)
      if (existing.has(slug)) {
        skipped.push({ slug, reason: 'Already registered' })
        continue
      }
      const site = await this.create(presetToSiteInput(preset, slug))
      created.push({ slug: site.slug, name: site.name, provider: site.provider })
    }

    return { created, skipped }
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
  /**
   * How this site's content adds up: the items assigned to it, and the items assigned
   * to nobody (which no site publishes — see migration 053 and `content_sites`).
   */
  async contentCounts(siteId: string): Promise<{ owned: number; shared: number }> {
    const owned = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM content_sites cs
           JOIN content c ON c.id = cs.content_id
          WHERE cs.site_id = ? AND c.deleted_at IS NULL`
      )
      .bind(siteId)
      .first()
    const unassigned = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM content c
          WHERE c.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM content_sites cs WHERE cs.content_id = c.id)`
      )
      .first()

    return {
      owned: Number((owned as { count?: number })?.count ?? 0),
      shared: Number((unassigned as { count?: number })?.count ?? 0)
    }
  }
}

export type { CloudflareCredentials }
