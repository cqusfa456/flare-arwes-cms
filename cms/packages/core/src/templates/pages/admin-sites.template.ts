import { t } from '../../i18n/admin'
/**
 * Admin → Sites pages.
 *
 * The CMS is the control plane for every website: these pages own each site's
 * build (Cloudflare Pages Deploy Hook or Workers Builds API), its custom domain
 * bindings (Cloudflare API) and its content scope. All mutating actions go
 * through the JSON API in `routes/admin-sites.ts`; pages are rendered
 * server-side and reloaded after a mutation so the UI always reflects persisted
 * state.
 *
 * Nothing here is provider-specific by hand: labels, badges, which form fields
 * apply and which actions are offered all come from `services/site-providers`,
 * so the UI can never offer an action a provider cannot perform.
 */

import { renderAdminLayoutCatalyst } from '../layouts/admin-layout-catalyst.template'
import { escapeHtml } from '../../utils/sanitize'
import { getSiteProvider, SITE_PROVIDERS } from '../../services/site-providers'
import type { SiteProviderInfo, SiteProviderCapabilities } from '../../services/site-providers'
import { ARWES_SITE_PRESETS } from '../../services/site-presets'
import type { SitePreset } from '../../services/site-presets'
import type {
  Site,
  SiteDomain,
  SiteDeploymentInfo,
  CloudflareCredentialStatus,
  SiteDeployMode,
  SiteProvider
} from '../../services/sites'
import type { GithubDeployStatus } from '../../services/github-actions'

export interface SitesListPageData {
  sites: Array<Site & { domains: SiteDomain[]; contentOwned: number; contentShared: number }>
  /** Ordered provider catalog: grouping order, labels, badges and counts. */
  providers: SiteProviderInfo[]
  /** When set, `sites` only contains that provider's sites. */
  typeFilter: SiteProvider | null
  /** Total registered sites, ignoring the filter (used by the "All" chip). */
  totalCount: number
  presets: SitePreset[]
  credentials: CloudflareCredentialStatus
  github: GithubDeployStatus
  user?: { name: string; email: string; role: string }
  version?: string
}

export interface SiteDetailPageData {
  site: Site
  domains: SiteDomain[]
  deployments: SiteDeploymentInfo[]
  deploymentsError: string | null
  contentOwned: number
  contentShared: number
  credentials: CloudflareCredentialStatus
  capabilities: SiteProviderCapabilities
  /** Every deploy mode the CMS can drive, with its label (provider default included). */
  deployModes: Array<{ id: SiteDeployMode; label: string }>
  /** The mode this site actually uses: its own value, or the provider default. */
  effectiveDeployMode: SiteDeployMode
  github: GithubDeployStatus
  /** Masked build-time environment the CMS would push to a Worker trigger. */
  buildEnv: Array<{ key: string; value: string; secret: boolean; managed: boolean }>
  isPreset: boolean
  user?: { name: string; email: string; role: string }
  version?: string
}

const CARD = 'rounded-xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10'
const INPUT =
  'w-full rounded-lg border border-zinc-950/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-zinc-950 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500'
const LABEL = 'block text-sm/6 font-medium text-zinc-950 dark:text-white mb-2'
const PRIMARY_BTN =
  'inline-flex items-center justify-center rounded-lg bg-zinc-950 dark:bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:hover:bg-blue-700 transition-colors shadow-sm'
const SECONDARY_BTN =
  'inline-flex items-center justify-center rounded-lg border border-zinc-950/10 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors'

/**
 * Safe to embed inside an inline `<script>`: JSON is valid JavaScript, and
 * escaping `<` keeps a `</script>` in the data from closing the block early.
 */
const jsonForScript = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c')

/** Small provider pill, driven entirely by the provider catalog. */
const providerBadge = (provider: SiteProvider | string): string => {
  const info = getSiteProvider(provider)
  return `<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${info.badgeClass}">${escapeHtml(info.shortLabel)}</span>`
}

const buildBadge = (site: Site): string => {
  const status = (site.lastBuildStatus || '').toLowerCase()
  if (!site.lastBuildAt) {
    return `<span class="inline-flex items-center rounded-md bg-zinc-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Never built</span>`
  }
  if (status === 'failed') {
    return `<span class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">${t('Failed')}</span>`
  }
  if (status === 'queued' || status === 'building') {
    return `<span class="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">Queued</span>`
  }
  return `<span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">${escapeHtml(site.lastBuildStatus || 'ok')}</span>`
}

const domainBadge = (status: string): string => {
  if (status === 'active') {
    return `<span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">${t('Active')}</span>`
  }
  if (status === 'error') {
    return `<span class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">${t('Error')}</span>`
  }
  if (status === 'removed') {
    return `<span class="inline-flex items-center rounded-md bg-zinc-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Removed</span>`
  }
  return `<span class="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">Pending DNS</span>`
}

const fmtTime = (value: number | string | null): string => {
  if (value === null || value === undefined || value === '') return '—'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}

const primaryDomainOf = (domains: SiteDomain[]): SiteDomain | null => {
  const primary = domains.find((domain) => domain.isPrimary && domain.status === 'active')
  if (primary) return primary
  return domains.find((domain) => domain.status === 'active') ?? null
}

/** `<option>` list for a provider select, in catalog order. */
const providerOptions = (providers: SiteProviderInfo[], selected: SiteProvider | null): string =>
  providers
    .map(
      (provider) =>
        `<option value="${escapeHtml(provider.id)}" ${selected === provider.id ? 'selected' : ''}>${escapeHtml(provider.label)}</option>`
    )
    .join('')

/**
 * `<option>` list for a deploy-mode select. The empty leading option is the
 * provider default, so leaving it alone never pins a mode the CMS then has to
 * argue with (see {@link defaultDeployMode} in `services/sites`).
 */
/**
 * The two ways a site can publish (see `SiteContentMode`): at its own path prefixes,
 * or as a host of its own.
 */
const contentModeOptions = (selected: string | null | undefined): string =>
  ([
    ['paths', '路径模式：本机按前缀发布（/blog、/docs 等）'],
    ['standalone', '独立模式：本机是一个独立站点，发布自己的内容树']
  ] as Array<[string, string]>)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
    )
    .join('')

const deployModeOptions = (
  modes: Array<{ id: SiteDeployMode; label: string }>,
  selected: SiteDeployMode | ''
): string =>
  ['<option value="">Provider default</option>']
    .concat(
      modes.map(
        (mode) =>
          `<option value="${escapeHtml(mode.id)}" ${selected === mode.id ? 'selected' : ''}>${escapeHtml(mode.label)}</option>`
      )
    )
    .join('')

const credentialsBanner = (credentials: CloudflareCredentialStatus): string => {
  if (credentials.configured) {
    return `<div class="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 ${CARD}">
      <p class="text-sm text-emerald-800 dark:text-emerald-300">
        <strong>Cloudflare API connected</strong> — credentials from ${credentials.source === 'env' ? 'Worker secrets' : 'saved settings'}${credentials.accountId ? ` (account <code>${escapeHtml(credentials.accountId)}</code>)` : ''}. Domain bindings can be created and removed from here.
      </p>
    </div>`
  }
  return `<div class="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4 ${CARD}">
    <p class="text-sm font-medium text-amber-800 dark:text-amber-300">Cloudflare API credentials are not configured</p>
    <p class="mt-1 text-sm text-amber-700 dark:text-amber-400">
      Registering sites and triggering builds works without them, but <strong>domain bindings cannot be managed</strong> until you set <code>CF_API_TOKEN</code> and <code>CF_ACCOUNT_ID</code> as Worker secrets, or save them below.
    </p>
    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input id="cf-account-id" class="${INPUT}" placeholder="Cloudflare account ID" />
      <input id="cf-api-token" type="password" class="${INPUT}" placeholder="API token (see permissions below)" />
    </div>
    <p class="mt-3 text-xs text-amber-700 dark:text-amber-400">
      Token permissions — Pages sites: <code>Pages:Edit</code>, <code>Zone:Read</code>.
      Worker sites additionally need <code>Workers Scripts:Read</code> (to resolve the Worker tag) and
      <code>Workers Builds Configuration:Edit</code> (to read builds, trigger them and push the build environment).
      The Builds API only accepts a <strong>user-scoped</strong> token — account-scoped tokens are rejected with an "Invalid token" error.
    </p>
    <button onclick="saveCredentials()" class="mt-3 ${SECONDARY_BTN}">Save credentials</button>
    <div id="credentials-result" class="mt-2 text-sm"></div>
  </div>`
}

const credentialsScript = `
  async function saveCredentials() {
    var accountId = document.getElementById('cf-account-id');
    var apiToken = document.getElementById('cf-api-token');
    var result = document.getElementById('credentials-result');
    try {
      var response = await fetch('/admin/sites/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: accountId ? accountId.value : '', apiToken: apiToken ? apiToken.value : '' })
      });
      var data = await response.json();
      if (data.success) { location.reload(); return; }
      if (result) { result.className = 'mt-2 text-sm text-red-600 dark:text-red-400'; result.textContent = data.error || 'Failed to save credentials'; }
    } catch (error) {
      if (result) { result.className = 'mt-2 text-sm text-red-600 dark:text-red-400'; result.textContent = 'Failed to save credentials'; }
    }
  }
`

/**
 * Show only the fields the selected provider declares, and disable the inputs
 * of hidden wrappers so a value typed for one provider cannot leak into the
 * payload after switching to another. Embedded on every page that renders a
 * provider select (each page gets its own copy, they never share a scope).
 */
const providerFieldsScript = `
  function syncProviderFields() {
    var select = document.getElementById('site-provider') || document.getElementById('s-provider');
    var providerId = select ? select.value : '';
    var context = PROVIDER_INFO[providerId] || PROVIDER_INFO['external'] || { fields: [], setup: '', summary: '' };
    var allowed = context.fields || [];
    var wrappers = document.querySelectorAll('[data-provider-field]');
    for (var i = 0; i < wrappers.length; i++) {
      var wrapper = wrappers[i];
      var key = wrapper.getAttribute('data-provider-field');
      var visible = allowed.indexOf(key) !== -1;
      wrapper.style.display = visible ? '' : 'none';
      var inputs = wrapper.querySelectorAll('input, select, textarea');
      for (var j = 0; j < inputs.length; j++) { inputs[j].disabled = !visible; }
    }
    var setup = document.getElementById('provider-setup');
    if (setup) { setup.textContent = context.setup || ''; }
    var summary = document.getElementById('provider-summary');
    if (summary) { summary.textContent = context.summary || ''; }
  }
`

/**
 * Validate the Content Routes textarea locally before saving.
 *
 * `services/sites.ts` normalises and validates the value as well (an unknown
 * collection is a 400 with the collection named), but this is a build contract
 * typed by hand: invalid JSON should say so immediately instead of being posted.
 * An empty textarea — or an explicit `null` — means "no content routes", i.e. the
 * site builds the whole website. Returns `{ ok, value }` or `{ ok: false, error }`.
 */
const contentRoutesScript = `
  function readContentRoutes(id) {
    var el = document.getElementById(id);
    var raw = el ? el.value.trim() : '';
    if (raw === '') { return { ok: true, value: null }; }
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: 'Content routes must be valid JSON: ' + (error && error.message ? error.message : 'parse error') };
    }
    if (parsed === null) { return { ok: true, value: null }; }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Content routes must be a JSON object like {"blog-posts": ""}' };
    }
    var names = Object.keys(parsed);
    for (var i = 0; i < names.length; i++) {
      if (typeof parsed[names[i]] !== 'string') {
        return { ok: false, error: 'The route for "' + names[i] + '" must be a string path prefix (use "" for that host\\'s root)' };
      }
    }
    return { ok: true, value: parsed };
  }
`

// ---------------------------------------------------------------------------
// List page
// ---------------------------------------------------------------------------

export function renderSitesListPage(data: SitesListPageData): string {
  const providers = data.providers
  const typeFilter = data.typeFilter

  const labelOf = (id: string): string => {
    const info = providers.find((provider) => provider.id === id)
    return info ? info.label : getSiteProvider(id).label
  }

  // Counts come from the filtered list; the "All" chip always uses the
  // unfiltered total so it stays meaningful while a type filter is applied.
  const countOf = (providerId: string): number =>
    data.sites.filter((site) => site.provider === providerId).length

  const chipBase =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors'
  const chipActive = 'bg-zinc-950 text-white ring-zinc-950 dark:bg-white dark:text-zinc-950 dark:ring-white'
  const chipIdle =
    'bg-white dark:bg-white/5 text-zinc-700 dark:text-zinc-200 ring-zinc-950/10 dark:ring-white/15 hover:bg-zinc-50 dark:hover:bg-white/10'

  const filterChips = `
    <div class="flex flex-wrap items-center gap-2">
      <a href="/admin/sites" class="${chipBase} ${typeFilter === null ? chipActive : chipIdle}">All (${data.totalCount})</a>
      ${providers
        .map(
          (provider) =>
            `<a href="/admin/sites?type=${encodeURIComponent(provider.id)}" class="${chipBase} ${typeFilter === provider.id ? chipActive : chipIdle}">${escapeHtml(provider.shortLabel)} (${countOf(provider.id)})</a>`
        )
        .join('')}
    </div>`

  const activeProviders = typeFilter
    ? providers.filter((provider) => provider.id === typeFilter)
    : providers

  const sections = activeProviders
    .map((provider) => {
      const sites = data.sites.filter((site) => site.provider === provider.id)
      if (sites.length === 0) return ''
      const body = sites
        .map((site) => {
          const primary = primaryDomainOf(site.domains)
          const activeDomains = site.domains.filter((domain) => domain.status === 'active').length
          return `
          <div class="p-5 flex flex-wrap items-start justify-between gap-4" data-provider="${escapeHtml(site.provider)}">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <a href="/admin/sites/${encodeURIComponent(site.slug)}" class="text-sm font-semibold text-zinc-950 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">${escapeHtml(site.name)}</a>
                ${providerBadge(site.provider)}
                ${site.isActive ? '' : '<span class="inline-flex items-center rounded-md bg-zinc-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Inactive</span>'}
                ${buildBadge(site)}
              </div>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <code>${escapeHtml(site.slug)}</code>
              </p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                ${primary ? `Primary domain <code>${escapeHtml(primary.hostname)}</code>` : 'No active domain'}
                · ${activeDomains}/${site.domains.length} domains active
                · ${site.contentOwned} content items (${site.contentShared} shared)
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="triggerBuild('${escapeHtml(site.id)}', this)" class="${SECONDARY_BTN}">${t('Build now')}</button>
              <a href="/admin/sites/${encodeURIComponent(site.slug)}" class="${PRIMARY_BTN}">Manage</a>
            </div>
          </div>`
        })
        .join('')

      return `
      <div>
        <div class="px-5 pt-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">${escapeHtml(provider.label)}</h2>
              ${providerBadge(provider.id)}
              <span class="text-xs text-zinc-500 dark:text-zinc-400">${sites.length} site${sites.length === 1 ? '' : 's'}</span>
            </div>
            ${typeFilter === provider.id ? `<a href="/admin/sites" class="text-xs text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400">Clear filter</a>` : ''}
          </div>
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(provider.summary)}</p>
        </div>
        <div class="mt-4 divide-y divide-zinc-950/5 dark:divide-white/5 border-t border-zinc-950/5 dark:border-white/5">${body}</div>
      </div>`
    })
    .filter((section) => section !== '')
    .join('')

  const rows = data.sites.length === 0
    ? `<div class="p-10 text-center">
         <p class="text-sm text-zinc-500 dark:text-zinc-400">No sites registered yet.</p>
         <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Register a site to own its build, domains and content from here — or import the Arwes presets to create the documentation site in one click.</p>
       </div>`
    : `<div class="divide-y divide-zinc-950/5 dark:divide-white/5">${sections}</div>`

  const content = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">${t('Sites')}</h1>
          <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">One control plane for every website: builds, domain bindings and content.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="importPresets(this)" class="${SECONDARY_BTN}">Import Arwes presets</button>
          <a href="/admin/sites/new" class="${PRIMARY_BTN}">Register site</a>
        </div>
      </div>

      ${credentialsBanner(data.credentials)}

      ${filterChips}

      <div class="${CARD}">${rows}</div>
      <div id="build-result" class="text-sm"></div>
    </div>

    <script>
      // Keyed by provider id so a row's label can be resolved from the list.
      var PROVIDER_INFO = ${jsonForScript(
        Object.fromEntries(providers.map((provider) => [provider.id, { id: provider.id, label: provider.label }]))
      )};

      async function triggerBuild(siteId, button) {
        var result = document.getElementById('build-result');
        var original = button ? button.textContent : '';
        if (button) { button.textContent = 'Triggering...'; button.disabled = true; }
        try {
          var response = await fetch('/admin/sites/api/sites/' + siteId + '/build', { method: 'POST' });
          var data = await response.json();
          if (result) {
            result.className = data.success ? 'text-sm text-emerald-600 dark:text-emerald-400' : 'text-sm text-red-600 dark:text-red-400';
            result.textContent = data.success
              ? 'Build queued on ' + providerLabel(siteId) + (data.buildUrl ? ' — ' + data.buildUrl : '') + '. Refresh in a minute to see the deployment.'
              : (data.error || 'Failed to trigger build');
          }
        } catch (error) {
          if (result) { result.className = 'text-sm text-red-600 dark:text-red-400'; result.textContent = 'Failed to trigger build'; }
        } finally {
          if (button) { button.textContent = original; button.disabled = false; }
        }
      }

      // The list is grouped by provider, so the row itself carries the label the
      // success message needs (the button's argument is the site id, not a type).
      function providerLabel(siteId) {
        var button = document.querySelector('[onclick*="' + siteId + '"]');
        var row = button ? button.closest('[data-provider]') : null;
        var id = row ? row.getAttribute('data-provider') : '';
        var info = PROVIDER_INFO[id];
        return info ? info.label : 'the hosting provider';
      }

      async function importPresets(button) {
        var result = document.getElementById('build-result');
        var original = button ? button.textContent : '';
        if (button) { button.textContent = 'Importing...'; button.disabled = true; }
        try {
          var response = await fetch('/admin/sites/api/presets/import', { method: 'POST' });
          var data = await response.json();
          if (result) {
            if (data.success) {
              var created = (data.created || []).map(function (entry) { return entry.slug; });
              var skipped = (data.skipped || []).map(function (entry) { return entry.slug + ' (' + entry.reason + ')'; });
              var lines = [];
              lines.push(created.length ? 'Created: ' + created.join(', ') : 'Created: none');
              if (skipped.length) { lines.push('Skipped: ' + skipped.join(', ')); }
              result.className = 'text-sm text-emerald-600 dark:text-emerald-400';
              result.textContent = lines.join(' · ');
              setTimeout(function () { location.reload(); }, 1200);
              return;
            }
            result.className = 'text-sm text-red-600 dark:text-red-400';
            result.textContent = data.error || 'Failed to import presets';
          }
        } catch (error) {
          if (result) { result.className = 'text-sm text-red-600 dark:text-red-400'; result.textContent = 'Failed to import presets'; }
        } finally {
          if (button) { button.textContent = original; button.disabled = false; }
        }
      }

      ${credentialsScript}
    </script>
  `

  return renderAdminLayoutCatalyst({
    title: t('Sites'),
    pageTitle: 'Sites',
    currentPath: '/admin/sites',
    version: data.version,
    ...(data.user ? { user: data.user } : {}),
    content
  })
}

// ---------------------------------------------------------------------------
// New site page
// ---------------------------------------------------------------------------

export function renderSiteNewPage(data: {
  credentials: CloudflareCredentialStatus
  providers: SiteProviderInfo[]
  presets: SitePreset[]
  deployModes: Array<{ id: SiteDeployMode; label: string }>
  github: GithubDeployStatus
  user?: { name: string; email: string; role: string }
  version?: string
}): string {
  const presetsJson = jsonForScript(
    data.presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      slug: preset.slug,
      provider: preset.provider,
      cfProjectName: preset.cfProjectName,
      description: preset.description,
      gitRepo: preset.gitRepo,
      gitBranch: preset.gitBranch,
      buildCommand: preset.buildCommand,
      deployCommand: preset.deployCommand,
      rootDir: preset.rootDir,
      outputDir: preset.outputDir,
      notes: preset.notes
    }))
  )
  const providersJson = jsonForScript(
    Object.fromEntries(
      data.providers.map((provider) => [
        provider.id,
        {
          id: provider.id,
          label: provider.label,
          summary: provider.summary,
          fields: provider.fields,
          setup: provider.setup,
          can: provider.can
        }
      ])
    )
  )

  const presetOptions = data.presets
    .map(
      (preset) =>
        `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}${preset.template ? ' (template)' : ''}</option>`
    )
    .join('')

  const defaultProvider = data.providers[0]?.id ?? 'cloudflare-pages'

  const content = `
    <div class="space-y-6 max-w-3xl">
      <div>
        <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Register a site</h1>
        <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
          A site owns a Cloudflare build target (builds + domains) and, optionally, a slice of content.
          Which fields apply depends on the hosting provider you pick.
        </p>
      </div>

      ${credentialsBanner(data.credentials)}

      <div class="${CARD} p-6 space-y-5">
        <div>
          <label class="${LABEL}">Start from</label>
          <div class="flex flex-wrap items-center gap-2">
            <select id="site-preset" class="${INPUT} flex-1 min-w-56">
              <option value="">— Blank site —</option>
              ${presetOptions}
            </select>
            <button onclick="applyPreset()" class="${SECONDARY_BTN}">${t('Apply')}</button>
          </div>
          <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            A preset fills in the monorepo's build contract — <code>{{slug}}</code> in a command is replaced with the site slug you enter below.
          </p>
        </div>
      </div>

      <div class="${CARD} p-6 space-y-5">
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label class="${LABEL}">${t('Name')}</label>
            <input id="site-name" class="${INPUT}" placeholder="ARWES Docs" />
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Human readable label shown in the admin.</p>
          </div>
          <div>
            <label class="${LABEL}">${t('Slug')}</label>
            <input id="site-slug" class="${INPUT}" placeholder="docs" />
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">URL-safe identifier, generated from the name when left blank.</p>
          </div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">Hosting provider</label>
            <select id="site-provider" class="${INPUT}">
              ${providerOptions(data.providers, defaultProvider)}
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" id="provider-summary"></p>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" id="provider-setup"></p>
          </div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">${t('Publishing mode')}</label>
            <select id="site-content-mode" class="${INPUT}">
              ${contentModeOptions('paths')}
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              ${t('Paths serve this site at /blog, /docs and so on; standalone makes it the home of the collections in its content routes.')}
            </p>
          </div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">${t('Deploy mode')}</label>
            <select id="site-deploy-mode" class="${INPUT}">
              ${deployModeOptions(data.deployModes, '')}
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              How the CMS starts a build. Leave it on the provider default unless this site builds through GitHub Actions
              (no Git connection in Cloudflare) or a Deploy Hook.
            </p>
          </div>
          <div data-provider-field="project">
            <label class="${LABEL}">Worker name / Pages project</label>
            <input id="site-project" class="${INPUT}" placeholder="arwes-docs" />
          </div>
          <div data-provider-field="deployHook">
            <label class="${LABEL}">Deploy Hook URL</label>
            <input id="site-hook" class="${INPUT}" placeholder="https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/…" />
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Worker: Settings → Builds → Deploy Hooks (<code>/workers/builds/deploy_hooks/…</code>).
              Pages: Settings → Builds (<code>/pages/webhooks/deploy_hooks/…</code>). The CMS rejects a mismatched hook.
            </p>
          </div>
          <div data-provider-field="gitRepo">
            <label class="${LABEL}">Git repository</label>
            <input id="site-repo" class="${INPUT}" placeholder="owner/repo" />
          </div>
          <div data-provider-field="gitBranch">
            <label class="${LABEL}">Git branch</label>
            <input id="site-branch" class="${INPUT}" value="main" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div data-provider-field="buildCommand">
            <label class="${LABEL}">Build command</label>
            <input id="site-build-command" class="${INPUT}" placeholder="npm run build" />
          </div>
          <div data-provider-field="deployCommand">
            <label class="${LABEL}">Deploy command</label>
            <input id="site-deploy-command" class="${INPUT}" placeholder="npx wrangler deploy" />
          </div>
          <div data-provider-field="outputDir">
            <label class="${LABEL}">Output directory</label>
            <input id="site-output-dir" class="${INPUT}" placeholder="apps/docs/build" />
          </div>
          <div data-provider-field="rootDir">
            <label class="${LABEL}">Root directory</label>
            <input id="site-root-dir" class="${INPUT}" placeholder="/" />
          </div>
          <div data-provider-field="zoneId">
            <label class="${LABEL}">Pinned Cloudflare zone id <span class="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span></label>
            <input id="site-zone" class="${INPUT}" placeholder="auto-detected from the hostname" />
          </div>
          <div data-provider-field="contentPrefix">
            <label class="${LABEL}">Content prefix</label>
            <input id="site-prefix" class="${INPUT}" placeholder="docs" />
          </div>
        </div>

        <div>
          <label class="${LABEL}">Content routes <span class="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span></label>
          <textarea id="site-content-routes" rows="3" class="${INPUT} font-mono text-xs" placeholder='{"blog-posts": ""}'></textarea>
                    <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            ${t('Paths mode builds the whole website: its own routes plus every collection at the prefix set on the collection, and a route here overrides that prefix ({"blog-posts": "/blog"} publishes the blog under /blog). Standalone mode makes the site a content-only host that publishes only the collections listed here, at the prefix given for this host ("" is that host root).')}
          </p>
        </div>

        <div>
          <label class="${LABEL}">${t('Description')}</label>
          <input id="site-description" class="${INPUT}" placeholder="Documentation site" />
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-zinc-950/5 dark:border-white/10">
          <div id="create-result" class="text-sm"></div>
          <div class="flex items-center gap-2">
            <a href="/admin/sites" class="${SECONDARY_BTN}">${t('Cancel')}</a>
            <button onclick="createSite()" class="${PRIMARY_BTN}">Register site</button>
          </div>
        </div>
      </div>
    </div>

    <script>
      var PRESETS = ${presetsJson};
      var PROVIDER_INFO = ${providersJson};

      function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }

      function fill(id, value) {
        var el = document.getElementById(id);
        if (el && value) { el.value = value; }
      }

      function fillIfEmpty(id, value) {
        var el = document.getElementById(id);
        if (el && value && !el.value) { el.value = value; }
      }

      // Preset commands describe an Astro app generically; {{slug}} becomes the
      // slug the operator typed. With no slug yet the placeholder is left in
      // place, so it stays visible as a reminder instead of becoming a path
      // like ./apps//scripts/build-worker.sh.
      function withSlug(value, slug) {
        if (!slug) { return String(value == null ? '' : value); }
        return String(value).replace(/\{\{\s*slug\s*\}\}/g, slug);
      }

      function reportResult(id, ok, message) {
        var el = document.getElementById(id);
        if (!el) return;
        el.className = ok ? 'text-sm text-emerald-600 dark:text-emerald-400' : 'text-sm text-red-600 dark:text-red-400';
        el.textContent = message;
      }

      function applyPreset() {
        var select = document.getElementById('site-preset');
        var presetId = select ? select.value : '';
        if (!presetId) { return; }
        var preset = null;
        for (var i = 0; i < PRESETS.length; i++) { if (PRESETS[i].id === presetId) { preset = PRESETS[i]; break; } }
        if (!preset) { return; }

        var slug = val('site-slug') || preset.slug || '';
        fillIfEmpty('site-name', preset.name);
        fillIfEmpty('site-slug', preset.slug);
        fill('site-provider', preset.provider);
        fill('site-project', withSlug(preset.cfProjectName, slug));
        fill('site-repo', preset.gitRepo);
        fill('site-branch', preset.gitBranch);
        fill('site-build-command', withSlug(preset.buildCommand, slug));
        fill('site-deploy-command', withSlug(preset.deployCommand, slug));
        fill('site-root-dir', preset.rootDir);
        fill('site-output-dir', withSlug(preset.outputDir, slug));
        fill('site-description', preset.description);
        syncProviderFields();
        reportResult('create-result', true, (preset.notes || []).join(' '));
      }

      ${providerFieldsScript}

      ${contentRoutesScript}

      async function createSite() {
        var result = document.getElementById('create-result');
        // Validated before anything is sent: a hand-typed build contract should
        // not be posted just to come back as a 400.
        var contentRoutes = readContentRoutes('site-content-routes');
        if (!contentRoutes.ok) {
          reportResult('create-result', false, contentRoutes.error);
          return;
        }
        result.className = 'text-sm text-zinc-500 dark:text-zinc-400';
        result.textContent = 'Saving...';
        // The backend normalises the slug, so substitute with what we sent: a
        // preset command like ./apps/{{slug}}/build-worker.sh has to point at
        // the directory the operator named.
        var slug = val('site-slug') || val('site-name');
        try {
          var response = await fetch('/admin/sites/api/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: val('site-name'),
              slug: val('site-slug'),
              description: val('site-description'),
              provider: val('site-provider'),
              cfProjectName: withSlug(val('site-project'), slug),
              deployHookUrl: val('site-hook'),
              gitRepo: val('site-repo'),
              gitBranch: val('site-branch'),
              buildCommand: withSlug(val('site-build-command'), slug),
              deployCommand: withSlug(val('site-deploy-command'), slug),
              outputDir: withSlug(val('site-output-dir'), slug),
              rootDir: val('site-root-dir'),
              cfZoneId: val('site-zone'),
              contentPrefix: val('site-prefix'),
              // null = this site builds the whole website (the column stays NULL).
              content_routes: contentRoutes.value,
              contentMode: val('site-content-mode') || undefined,
              // Omitted when empty so the site stays on its provider default.
              deployMode: val('site-deploy-mode') || undefined
            })
          });
          var data = await response.json();
          if (data.success && data.site) { window.location.href = '/admin/sites/' + encodeURIComponent(data.site.slug); return; }
          result.className = 'text-sm text-red-600 dark:text-red-400';
          result.textContent = data.error || 'Failed to register site';
        } catch (error) {
          result.className = 'text-sm text-red-600 dark:text-red-400';
          result.textContent = 'Failed to register site';
        }
      }

      document.addEventListener('DOMContentLoaded', function () {
        syncProviderFields();
        var providerSelect = document.getElementById('site-provider');
        if (providerSelect) { providerSelect.addEventListener('change', syncProviderFields); }
      });

      ${credentialsScript}
    </script>
  `

  return renderAdminLayoutCatalyst({
    title: 'Register site',
    pageTitle: 'Register site',
    currentPath: '/admin/sites',
    version: data.version,
    ...(data.user ? { user: data.user } : {}),
    content
  })
}

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

export function renderSiteDetailPage(data: SiteDetailPageData): string {
  const { site, domains, capabilities } = data
  const providerInfo = getSiteProvider(site.provider)

  // The effective mode is always resolved (site value, else provider default),
  // so the label lookup can only miss if the catalog and the site disagree.
  const effectiveMode = data.deployModes.find((mode) => mode.id === data.effectiveDeployMode)
  const deployModeLabel = effectiveMode ? effectiveMode.label : data.effectiveDeployMode

  const githubSourceLabel =
    data.github.source === 'env'
      ? 'Worker secrets'
      : data.github.source === 'settings'
        ? 'saved settings'
        : 'nowhere yet'
  const githubStatus = data.github.configured
    ? `Configured from ${githubSourceLabel} · token ${data.github.hasToken ? 'saved' : 'missing'}${data.github.repo ? ` · repository ${data.github.repo}` : ''}`
    : 'not configured'

  // Where the build actually runs, in the site's own terms: the generic sentence
  // is right for the Cloudflare-side routes, the dispatch one for GitHub.
  const buildRouteSentence = capabilities.triggerBuildViaGithubActions
    ? `${providerInfo.label} needs no Git connection and no Deploy Hook: the CMS dispatches a GitHub Actions workflow that runs this site's build and deploy commands and uploads the output directly.`
    : `${providerInfo.label} performs the build; the CMS only triggers it${capabilities.triggerBuildViaApi ? ' through the Builds API or' : ' through'}${capabilities.triggerBuildViaHook ? ' the Deploy Hook' : ''}.`

  const githubTarget = data.github.configured
    ? `<p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        GitHub target <code class="text-zinc-900 dark:text-zinc-100">${escapeHtml(data.github.repo ?? '—')}</code>
        · workflow <code class="text-zinc-900 dark:text-zinc-100">${escapeHtml(data.github.workflow)}</code>
        @ <code class="text-zinc-900 dark:text-zinc-100">${escapeHtml(data.github.ref)}</code>
        · credentials from ${escapeHtml(githubSourceLabel)}
      </p>`
    : `<p class="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        GitHub Actions is not configured yet: a dispatch needs <strong>both a token and a repository</strong>, so this button will fail until they are saved.
        Set them in the <strong>GitHub deploy</strong> card below, or set the <code>GITHUB_TOKEN</code> and <code>GITHUB_REPO</code> Worker secrets.
      </p>`

  const githubCard = `
      <!-- GitHub deploy -->
      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">GitHub deploy</h2>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          This is how a site can be built with <strong>no Git connection on Cloudflare's side</strong>: the CMS dispatches
          <code>${escapeHtml(data.github.workflow)}</code>, which runs the site's build command and then its deploy command on a GitHub runner and uploads the output directly.
        </p>
        <div class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label class="${LABEL}">Repository (owner/name)</label>
            <input id="gh-repo" class="${INPUT}" value="${escapeHtml(data.github.repo ?? '')}" placeholder="owner/repo" />
          </div>
          <div>
            <label class="${LABEL}">Token</label>
            <input id="gh-token" type="password" class="${INPUT}" placeholder="leave blank to keep the saved token" autocomplete="new-password" />
          </div>
        </div>
        <p class="mt-3 text-xs ${data.github.configured ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}">${escapeHtml(githubStatus)}</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button onclick="saveGithub(this)" class="${SECONDARY_BTN}">Save GitHub settings</button>
          <div id="github-result" class="text-sm"></div>
        </div>
        <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          The token needs <code>Actions: write</code> (fine-grained, scoped to this repository) or the classic <code>workflow</code> scope.
          It is stored with the deploy settings and never rendered back into this page.
        </p>
      </div>`

  const domainRows = domains.length === 0
    ? `<tr><td colspan="4" class="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No domains bound yet.</td></tr>`
    : domains.map((domain) => `
        <tr class="border-t border-zinc-950/5 dark:border-white/5">
          <td class="px-4 py-3">
            <code class="text-xs text-zinc-900 dark:text-zinc-100">${escapeHtml(domain.hostname)}</code>
            ${domain.isPrimary ? '<span class="ml-2 inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white">Primary</span>' : ''}
          </td>
          <td class="px-4 py-3">${domainBadge(domain.status)}</td>
          <td class="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(domain.validationErrors || domain.validationStatus || '—')}</td>
          <td class="px-4 py-3 text-right whitespace-nowrap">
            ${domain.status === 'removed' ? '' : `
              ${domain.status === 'active' && !domain.isPrimary ? `<button onclick="makePrimary('${escapeHtml(domain.hostname)}')" class="text-xs text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 mr-3">Make primary</button>` : ''}
              <button onclick="removeDomain('${escapeHtml(domain.hostname)}')" class="text-xs text-red-600 dark:text-red-400 hover:underline">Unbind</button>
            `}
          </td>
        </tr>`).join('')

  const deploymentRows = data.deployments.length === 0
    ? `<p class="text-sm text-zinc-500 dark:text-zinc-400">${data.deploymentsError ? escapeHtml(data.deploymentsError) : 'No deployments reported yet.'}</p>`
    : `<div class="space-y-2">
        ${data.deployments.map((deployment) => `
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="min-w-0">
              <span class="text-zinc-900 dark:text-zinc-100">${escapeHtml(deployment.environment || 'production')}</span>
              <span class="text-zinc-400 dark:text-zinc-500">· ${escapeHtml(deployment.stage || 'unknown stage')} · ${escapeHtml(fmtTime(deployment.createdAt))}</span>
              ${deployment.url ? `<a href="${escapeHtml(deployment.url)}" target="_blank" rel="noopener noreferrer" class="ml-2 text-indigo-600 dark:text-indigo-400 hover:underline">open</a>` : ''}
            </div>
            <span class="text-zinc-500 dark:text-zinc-400">${escapeHtml(deployment.status || '—')}</span>
          </div>`).join('')}
      </div>`

  const buildRows = data.buildEnv.length === 0
    ? `<tr><td colspan="2" class="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No build variables resolved for this site.</td></tr>`
    : data.buildEnv.map((entry) => `
        <tr class="border-t border-zinc-950/5 dark:border-white/5">
          <td class="px-4 py-2 align-top"><code class="text-xs text-zinc-900 dark:text-zinc-100">${escapeHtml(entry.key)}</code></td>
          <td class="px-4 py-2 align-top">
            <code class="text-xs text-zinc-600 dark:text-zinc-300 break-all">${escapeHtml(entry.value)}</code>
            ${entry.secret ? '<span class="ml-2 inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">secret</span>' : ''}
            ${entry.managed ? '<span class="ml-2 inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">managed by CMS</span>' : ''}
          </td>
        </tr>`).join('')

  const buildEnvCard = capabilities.pushBuildEnv
    ? `
      <!-- Build environment -->
      <div class="${CARD} p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Build environment</h2>
          <button onclick="pushBuildEnv(this)" class="${SECONDARY_BTN}">Push build environment</button>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left">
            <thead class="text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr><th class="px-4 py-2 font-medium">Key</th><th class="px-4 py-2 font-medium">Value</th></tr>
            </thead>
            <tbody>${buildRows}</tbody>
          </table>
        </div>
        <p class="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          These variables are pushed to the Workers Builds trigger, which is how a build knows which CMS and which site it is building for.
          Values are masked where they are secret. A site can override any of them by adding the same key under "Site settings".
        </p>
        <label class="mt-3 inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" id="s-rotate-token" class="rounded border-zinc-300 dark:border-white/20" />
          Rotate the content token on the next push
        </label>
      </div>`
    : `
      <!-- Build environment -->
      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Build environment</h2>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Build variables for this provider are configured in Cloudflare (${escapeHtml(providerInfo.label)}), not by the CMS.
        </p>
      </div>`

  const content = `
    <div class="space-y-6 max-w-4xl">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <a href="/admin/sites" class="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">${t('Sites')}</a>
            <span class="text-zinc-300 dark:text-zinc-600">/</span>
            <h1 class="text-xl font-semibold text-zinc-950 dark:text-white">${escapeHtml(site.name)}</h1>
            ${providerBadge(site.provider)}
            ${data.isPreset ? '<span class="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-400/20">Arwes preset</span>' : ''}
            ${buildBadge(site)}
          </div>
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400"><code>${escapeHtml(site.slug)}</code></p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="triggerBuild(this, '${capabilities.triggerBuildViaApi ? 'api' : 'hook'}')" class="${SECONDARY_BTN}" ${capabilities.triggerBuild ? '' : 'disabled title="This provider cannot be built from the CMS"'}>${capabilities.triggerBuildViaGithubActions ? 'Deploy via GitHub Actions' : 'Build now'}</button>
          ${capabilities.triggerBuildViaHook && site.deployHookUrl ? `<button onclick="triggerBuild(this, 'hook')" class="${SECONDARY_BTN}">Build via Deploy Hook</button>` : ''}
        </div>
      </div>

      <div id="action-result" class="text-sm"></div>

      ${credentialsBanner(data.credentials)}

      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Hosting setup</h2>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(providerInfo.summary)}</p>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(providerInfo.setup)}</p>
      </div>

      <!-- Build -->
      <div class="${CARD} p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Builds</h2>
          ${capabilities.listDeployments ? `<button onclick="refreshDeployments(this)" class="${SECONDARY_BTN}">Refresh deployments</button>` : ''}
        </div>
        <dl class="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 text-xs">
          <div class="flex justify-between gap-4"><dt class="text-zinc-500 dark:text-zinc-400">Last triggered</dt><dd class="text-zinc-900 dark:text-zinc-100">${escapeHtml(fmtTime(site.lastBuildAt))}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-zinc-500 dark:text-zinc-400">${t('Status')}</dt><dd class="text-zinc-900 dark:text-zinc-100">${escapeHtml(site.lastBuildStatus || '—')}</dd></div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-zinc-500 dark:text-zinc-400">${t('Publishing mode')}</dt>
            <dd>
              <span class="inline-flex items-center rounded-md bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300 ring-1 ring-inset ring-teal-600/20 dark:ring-teal-400/20">${escapeHtml(site.contentMode === 'paths' ? '路径模式' : '独立模式')}</span>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-zinc-500 dark:text-zinc-400">${t('Deploy mode')}</dt>
            <dd>
              <span class="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-400/20">${escapeHtml(deployModeLabel)}</span>
              ${site.deployMode === null ? '<span class="ml-2 text-zinc-500 dark:text-zinc-400">provider default</span>' : ''}
            </dd>
          </div>
        </dl>
        ${site.lastBuildError ? `<p class="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">${escapeHtml(site.lastBuildError)}</p>` : ''}
        <p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400">${escapeHtml(buildRouteSentence)}</p>
        ${capabilities.triggerBuildViaGithubActions ? githubTarget : ''}
        ${capabilities.listDeployments ? `<div id="deployments" class="mt-4">${deploymentRows}</div>` : ''}
      </div>

      ${buildEnvCard}

      ${githubCard}

      ${capabilities.manageDomains ? `
      <!-- Domains -->
      <div class="${CARD} p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Domain bindings</h2>
          <button onclick="refreshDomains(this)" class="${SECONDARY_BTN}" ${data.credentials.configured ? '' : 'disabled'}>Refresh from Cloudflare</button>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left">
            <thead class="text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr><th class="px-4 py-2 font-medium">Hostname</th><th class="px-4 py-2 font-medium">${t('Status')}</th><th class="px-4 py-2 font-medium">${t('Validation')}</th><th class="px-4 py-2"></th></tr>
            </thead>
            <tbody>${domainRows}</tbody>
          </table>
        </div>
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-56">
            <label class="${LABEL}">Bind a custom domain</label>
            <input id="new-domain" class="${INPUT}" placeholder="docs.example.com" ${data.credentials.configured ? '' : 'disabled'} />
          </div>
          <button onclick="addDomain(this)" class="${SECONDARY_BTN}" ${data.credentials.configured ? '' : 'disabled'}>Bind domain</button>
        </div>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">The domain is attached to ${escapeHtml(providerInfo.label)} through the Cloudflare API; DNS still has to point at the site for it to become active.</p>
      </div>` : ''}

      <!-- Settings -->
      <div class="${CARD} p-6 space-y-5">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Site settings</h2>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div><label class="${LABEL}">${t('Name')}</label><input id="s-name" class="${INPUT}" value="${escapeHtml(site.name)}" /></div>
          <div><label class="${LABEL}">${t('Slug')}</label><input id="s-slug" class="${INPUT}" value="${escapeHtml(site.slug)}" /></div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">Hosting provider</label>
            <select id="s-provider" class="${INPUT}">
              ${providerOptions(SITE_PROVIDERS, site.provider)}
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" id="provider-summary"></p>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400" id="provider-setup"></p>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Changing this switches which Cloudflare API is used for domains, builds and the build environment; existing bindings are not migrated automatically.
            </p>
          </div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">${t('Publishing mode')}</label>
            <select id="s-content-mode" class="${INPUT}">
              ${contentModeOptions(site.contentMode)}
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              ${t('Paths serve this site at /blog, /docs and so on; standalone makes it the home of the collections in its content routes.')}
            </p>
          </div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">${t('Deploy mode')}</label>
            <select id="s-deploy-mode" class="${INPUT}">
              ${deployModeOptions(data.deployModes, data.effectiveDeployMode)}
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              How the CMS starts a build. The provider default is shown resolved above; picking "Provider default" clears the
              pinned mode so the site follows the provider again.
            </p>
          </div>
          <div data-provider-field="project"><label class="${LABEL}">Worker name / Pages project</label><input id="s-project" class="${INPUT}" value="${escapeHtml(site.cfProjectName || '')}" /></div>
          <div data-provider-field="gitBranch"><label class="${LABEL}">Git branch</label><input id="s-branch" class="${INPUT}" value="${escapeHtml(site.gitBranch || '')}" /></div>
          <div data-provider-field="deployHook" class="sm:col-span-2"><label class="${LABEL}">Deploy Hook URL</label><input id="s-hook" class="${INPUT}" value="${escapeHtml(site.deployHookUrl || '')}" /></div>
          <div data-provider-field="gitRepo" class="sm:col-span-2"><label class="${LABEL}">Git repository</label><input id="s-repo" class="${INPUT}" value="${escapeHtml(site.gitRepo || '')}" /></div>
          <div data-provider-field="buildCommand"><label class="${LABEL}">Build command</label><input id="s-build" class="${INPUT}" value="${escapeHtml(site.buildCommand || '')}" /></div>
          <div data-provider-field="deployCommand"><label class="${LABEL}">Deploy command</label><input id="s-deploy" class="${INPUT}" value="${escapeHtml(site.deployCommand || '')}" placeholder="npx wrangler deploy" /></div>
          <div data-provider-field="outputDir"><label class="${LABEL}">Output directory</label><input id="s-output" class="${INPUT}" value="${escapeHtml(site.outputDir || '')}" /></div>
          <div data-provider-field="rootDir"><label class="${LABEL}">Root directory</label><input id="s-root" class="${INPUT}" value="${escapeHtml(site.rootDir || '')}" /></div>
          <div data-provider-field="contentPrefix"><label class="${LABEL}">Content prefix</label><input id="s-prefix" class="${INPUT}" value="${escapeHtml(site.contentPrefix || '')}" placeholder="docs" /></div>
          <div data-provider-field="zoneId"><label class="${LABEL}">Pinned Cloudflare zone id <span class="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span></label><input id="s-zone" class="${INPUT}" value="${escapeHtml(site.cfZoneId || '')}" placeholder="auto-detected from the hostname" /></div>
        </div>
        <div class="mt-5">
          <label class="${LABEL}">Content routes <span class="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span></label>
          <textarea id="s-content-routes" rows="3" class="${INPUT} font-mono text-xs" placeholder='{"blog-posts": ""}'>${escapeHtml(
            site.contentRoutes ? JSON.stringify(site.contentRoutes, null, 2) : ''
          )}</textarea>
                      <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              ${t('Paths mode builds the whole website: its own routes plus every collection at the prefix set on the collection, and a route here overrides that prefix ({"blog-posts": "/blog"} publishes the blog under /blog). Standalone mode makes the site a content-only host that publishes only the collections listed here, at the prefix given for this host ("" is that host root).')}
            </p>
          <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            On <strong>独立模式</strong> this site is a <strong>content-only host</strong> that publishes just the collections listed here, at the prefix given for this host
            (<code>""</code> = that host's root, e.g. <code>{"blog-posts": ""}</code>). Collection names must already exist in Admin → Collections.
          </p>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" id="s-active" ${site.isActive ? 'checked' : ''} class="rounded border-zinc-300 dark:border-white/20" />
          Active (inactive sites cannot be built)
        </label>
        <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-950/5 dark:border-white/10">
          <div id="settings-result" class="text-sm"></div>
          <div class="flex items-center gap-2">
            ${capabilities.pushBuildEnv ? `<button onclick="pushBuildEnv(this)" class="${SECONDARY_BTN}" ${data.credentials.configured ? '' : 'disabled'}>Push build environment</button>` : ''}
            ${capabilities.syncBuildConfig ? `<button onclick="syncBuildConfig(this)" class="${SECONDARY_BTN}" ${data.credentials.configured ? '' : 'disabled'}>Push build config to Cloudflare</button>` : ''}
            <button onclick="saveSite(this)" class="${PRIMARY_BTN}">Save changes</button>
          </div>
        </div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">Build config was last pushed ${escapeHtml(fmtTime(site.buildConfigSyncedAt))}.</p>
      </div>

      <!-- Content -->
      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">${t('Content')}</h2>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          ${data.contentOwned} content item${data.contentOwned === 1 ? '' : 's'} owned by this site ·
          ${data.contentShared} shared item${data.contentShared === 1 ? '' : 's'} readable by every site.
        </p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Ownership is stored on <code>content.site_id</code>; shared content has no site.</p>
      </div>

      <!-- Danger -->
      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Unregistering removes the site and its domain records from the CMS. ${escapeHtml(providerInfo.label)} itself is left untouched.</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button onclick="deleteSite(this)" class="${SECONDARY_BTN}">Unregister site</button>
          <div id="delete-result" class="text-sm"></div>
        </div>
      </div>
    </div>

    <script>
      var SITE_ID = ${JSON.stringify(site.id)};
      var SITE_SLUG = ${JSON.stringify(site.slug)};
      var PROVIDER_LABEL = ${JSON.stringify(providerInfo.label)};
      var TRIGGER_VIA = ${JSON.stringify(capabilities.triggerBuildViaApi ? 'api' : 'hook')};
      var PROVIDER_INFO = ${jsonForScript(
        Object.fromEntries(
          SITE_PROVIDERS.map((provider) => [
            provider.id,
            {
              id: provider.id,
              label: provider.label,
              summary: provider.summary,
              fields: provider.fields,
              setup: provider.setup,
              can: provider.can
            }
          ])
        )
      )};

      function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }

      function report(id, ok, message) {
        var el = document.getElementById(id);
        if (!el) { alert(message); return; }
        el.className = ok ? 'text-sm text-emerald-600 dark:text-emerald-400' : 'text-sm text-red-600 dark:text-red-400';
        el.textContent = message;
      }

      async function call(path, options, resultId, okMessage) {
        try {
          var response = await fetch(path, options);
          var data = await response.json().catch(function () { return {}; });
          if (response.ok && data.success !== false) {
            if (okMessage) report(resultId, true, okMessage);
            return data;
          }
          report(resultId, false, data.error || ('Request failed (' + response.status + ')'));
        } catch (error) {
          report(resultId, false, 'Request failed');
        }
        return null;
      }

      ${providerFieldsScript}

      ${contentRoutesScript}

      async function triggerBuild(button, via) {
        var label = button ? button.textContent : '';
        if (button) { button.disabled = true; button.textContent = 'Triggering...'; }
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ via: via || TRIGGER_VIA })
        }, 'action-result');
        if (button) { button.disabled = false; button.textContent = label; }
        if (!data) return;
        // A dispatched workflow run takes minutes, so its message — and the link
        // to the run — has to survive instead of being wiped by a reload.
        if (data.via === 'github-actions') { reportGithubRun(data); return; }
        report('action-result', true, 'Build queued on ' + PROVIDER_LABEL
          + (data.via === 'api' ? ' through the Builds API' : ' through the Deploy Hook')
          + (data.buildUrl ? ' — ' + data.buildUrl : '') + '. Refresh deployments in a minute.');
        setTimeout(function () { location.reload(); }, 2500);
      }

      // The run URL is the whole point of the message: render it as a link, never
      // as text, and leave it on screen while the run finishes.
      function reportGithubRun(data) {
        var result = document.getElementById('action-result');
        if (!result) { return; }
        result.className = 'text-sm text-emerald-600 dark:text-emerald-400';
        result.textContent = 'Deploy dispatched on ' + PROVIDER_LABEL + ' as a GitHub Actions run. A run takes a few minutes';
        if (data.buildUrl) {
          var link = document.createElement('a');
          link.href = data.buildUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'ml-1 text-indigo-600 dark:text-indigo-400 hover:underline';
          link.textContent = 'watch the run on GitHub';
          result.appendChild(link);
        }
        result.appendChild(document.createTextNode('. Refresh deployments when it finishes.'));
      }

      // Separate path from the sites API, so it reuses call() without widening it.
      async function saveGithub(button) {
        if (button) button.disabled = true;
        var payload = { githubRepo: val('gh-repo') };
        var token = val('gh-token');
        if (token) { payload.githubToken = token; }
        var data = await call('/admin/deploy/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 'github-result', 'Saved');
        if (button) button.disabled = false;
        if (data) { setTimeout(function () { location.reload(); }, 800); }
      }

      async function saveSite(button) {
        // Invalid JSON is reported here instead of being saved: the textarea is a
        // build contract, and the server would reject it anyway (400).
        var contentRoutes = readContentRoutes('s-content-routes');
        if (!contentRoutes.ok) {
          report('settings-result', false, contentRoutes.error);
          return;
        }
        if (button) button.disabled = true;
        var payload = {
          name: val('s-name'), slug: val('s-slug'),
          provider: val('s-provider'),
          cfProjectName: val('s-project'),
          gitBranch: val('s-branch'), deployHookUrl: val('s-hook'), gitRepo: val('s-repo'),
          buildCommand: val('s-build'), deployCommand: val('s-deploy'),
          outputDir: val('s-output'), rootDir: val('s-root'),
          contentPrefix: val('s-prefix'), cfZoneId: val('s-zone'),
          // null = back to an app site that builds the whole website.
          content_routes: contentRoutes.value,
          contentMode: val('s-content-mode') || undefined,
          // An empty select means "provider default": the API stores null and
          // effectiveDeployMode() falls back to the provider's own mode.
          deployMode: val('s-deploy-mode') || null,
          isActive: document.getElementById('s-active').checked
        };
        var data = await call('/admin/sites/api/sites/' + SITE_ID, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }, 'settings-result', 'Saved');
        if (button) button.disabled = false;
        if (data && data.site && data.site.slug !== SITE_SLUG) {
          window.location.href = '/admin/sites/' + encodeURIComponent(data.site.slug);
        }
      }

      async function syncBuildConfig(button) {
        if (button) button.disabled = true;
        await call('/admin/sites/api/sites/' + SITE_ID + '/sync-build-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rotateToken: rotateTokenChecked() })
        }, 'settings-result', 'Build config pushed to ' + PROVIDER_LABEL);
        if (button) button.disabled = false;
      }

      function rotateTokenChecked() {
        var el = document.getElementById('s-rotate-token');
        return !!(el && el.checked);
      }

      async function pushBuildEnv(button) {
        if (button) button.disabled = true;
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/build-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rotateToken: rotateTokenChecked() })
        }, 'action-result', 'Build environment pushed to ' + PROVIDER_LABEL);
        if (button) button.disabled = false;
        if (data) location.reload();
      }

      async function addDomain(button) {
        var hostname = val('new-domain');
        if (!hostname) { report('action-result', false, 'Enter a hostname first'); return; }
        if (button) button.disabled = true;
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/domains', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: hostname })
        }, 'action-result', 'Domain bound — finish DNS configuration to activate it');
        if (button) button.disabled = false;
        if (data) location.reload();
      }

      async function removeDomain(hostname) {
        if (!confirm('Unbind ' + hostname + ' from this site?')) return;
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/domains/' + encodeURIComponent(hostname), { method: 'DELETE' },
          'action-result', 'Domain unbound');
        if (data) location.reload();
      }

      async function makePrimary(hostname) {
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/domains/primary', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: hostname })
        }, 'action-result', hostname + ' is now the primary domain');
        if (data) location.reload();
      }

      async function refreshDomains(button) {
        if (button) button.disabled = true;
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/domains/refresh', { method: 'POST' }, 'action-result',
          'Domain state refreshed from Cloudflare');
        if (button) button.disabled = false;
        if (data) location.reload();
      }

      async function refreshDeployments(button) {
        if (button) button.disabled = true;
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/deployments', {}, 'action-result');
        if (button) button.disabled = false;
        if (data && data.deployments) location.reload();
      }

      async function deleteSite(button) {
        if (!confirm('Unregister "' + SITE_SLUG + '"? Domain records are removed from the CMS.')) return;
        if (button) button.disabled = true;
        var data = await call('/admin/sites/api/sites/' + SITE_ID, { method: 'DELETE' }, 'delete-result');
        if (data) window.location.href = '/admin/sites';
        if (button) button.disabled = false;
      }

      document.addEventListener('DOMContentLoaded', function () {
        syncProviderFields();
        var providerSelect = document.getElementById('s-provider');
        if (providerSelect) { providerSelect.addEventListener('change', syncProviderFields); }
      });

      ${credentialsScript}
    </script>
  `

  return renderAdminLayoutCatalyst({
    title: site.name,
    pageTitle: site.name,
    currentPath: '/admin/sites',
    version: data.version,
    ...(data.user ? { user: data.user } : {}),
    content
  })
}
