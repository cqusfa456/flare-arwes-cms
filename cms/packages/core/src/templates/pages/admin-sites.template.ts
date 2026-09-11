/**
 * Admin → Sites pages.
 *
 * The CMS is the control plane for every website: these pages own each site's
 * build (Cloudflare Pages Deploy Hook), its custom domain bindings (Cloudflare
 * API) and its content scope. All mutating actions go through the JSON API in
 * `routes/admin-sites.ts`; pages are rendered server-side and reloaded after a
 * mutation so the UI always reflects persisted state.
 */

import { renderAdminLayoutCatalyst } from '../layouts/admin-layout-catalyst.template'
import { escapeHtml } from '../../utils/sanitize'
import type {
  Site,
  SiteDomain,
  SiteDeploymentInfo,
  CloudflareCredentialStatus
} from '../../services/sites'

export interface SitesListPageData {
  sites: Array<Site & { domains: SiteDomain[]; contentOwned: number; contentShared: number }>
  credentials: CloudflareCredentialStatus
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

const buildBadge = (site: Site): string => {
  const status = (site.lastBuildStatus || '').toLowerCase()
  if (!site.lastBuildAt) {
    return `<span class="inline-flex items-center rounded-md bg-zinc-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Never built</span>`
  }
  if (status === 'failed') {
    return `<span class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">Failed</span>`
  }
  if (status === 'queued' || status === 'building') {
    return `<span class="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">Queued</span>`
  }
  return `<span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">${escapeHtml(site.lastBuildStatus || 'ok')}</span>`
}

const domainBadge = (status: string): string => {
  if (status === 'active') {
    return `<span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Active</span>`
  }
  if (status === 'error') {
    return `<span class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">Error</span>`
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
      <code>Workers Builds Configuration:Edit</code> (to read builds and trigger them).
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

// ---------------------------------------------------------------------------
// List page
// ---------------------------------------------------------------------------

export function renderSitesListPage(data: SitesListPageData): string {
  const rows = data.sites.length === 0
    ? `<div class="p-10 text-center">
         <p class="text-sm text-zinc-500 dark:text-zinc-400">No sites registered yet.</p>
         <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Register a site to own its build, domains and content from here.</p>
       </div>`
    : `<div class="divide-y divide-zinc-950/5 dark:divide-white/5">
        ${data.sites.map((site) => {
          const primary = primaryDomainOf(site.domains)
          const activeDomains = site.domains.filter((domain) => domain.status === 'active').length
          return `
          <div class="p-5 flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <a href="/admin/sites/${encodeURIComponent(site.slug)}" class="text-sm font-semibold text-zinc-950 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">${escapeHtml(site.name)}</a>
                ${site.isActive ? '' : '<span class="inline-flex items-center rounded-md bg-zinc-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Inactive</span>'}
                ${buildBadge(site)}
              </div>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <code>${escapeHtml(site.slug)}</code>
                ${site.cfProjectName ? ` · Pages project <code>${escapeHtml(site.cfProjectName)}</code>` : ' · no Pages project'}
              </p>
              <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                ${primary ? `Primary domain <code>${escapeHtml(primary.hostname)}</code>` : 'No active domain'}
                · ${activeDomains}/${site.domains.length} domains active
                · ${site.contentOwned} content items (${site.contentShared} shared)
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="triggerBuild('${escapeHtml(site.id)}', this)" class="${SECONDARY_BTN}">Build now</button>
              <a href="/admin/sites/${encodeURIComponent(site.slug)}" class="${PRIMARY_BTN}">Manage</a>
            </div>
          </div>`
        }).join('')}
      </div>`

  const content = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Sites</h1>
          <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">One control plane for every website: builds, domain bindings and content.</p>
        </div>
        <a href="/admin/sites/new" class="${PRIMARY_BTN}">Register site</a>
      </div>

      ${credentialsBanner(data.credentials)}

      <div class="${CARD}">${rows}</div>
      <div id="build-result" class="text-sm"></div>
    </div>

    <script>
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
              ? 'Build queued on Cloudflare Pages' + (data.buildUrl ? ' — ' + data.buildUrl : '') + '. Refresh in a minute to see the deployment.'
              : (data.error || 'Failed to trigger build');
          }
        } catch (error) {
          if (result) { result.className = 'text-sm text-red-600 dark:text-red-400'; result.textContent = 'Failed to trigger build'; }
        } finally {
          if (button) { button.textContent = original; button.disabled = false; }
        }
      }
      ${credentialsScript}
    </script>
  `

  return renderAdminLayoutCatalyst({
    title: 'Sites',
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
  user?: { name: string; email: string; role: string }
  version?: string
}): string {
  const content = `
    <div class="space-y-6 max-w-3xl">
      <div>
        <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">Register a site</h1>
        <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
          A site owns a Cloudflare Pages project (builds + domains) and, optionally, a slice of content.
        </p>
      </div>

      ${credentialsBanner(data.credentials)}

      <div class="${CARD} p-6 space-y-5">
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label class="${LABEL}">Name</label>
            <input id="site-name" class="${INPUT}" placeholder="ARWES Docs" />
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Human readable label shown in the admin.</p>
          </div>
          <div>
            <label class="${LABEL}">Slug</label>
            <input id="site-slug" class="${INPUT}" placeholder="docs" />
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">URL-safe identifier, generated from the name when left blank.</p>
          </div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">Hosting provider</label>
            <select id="site-provider" class="${INPUT}">
              <option value="cloudflare-worker">Cloudflare Worker + static assets (recommended for multiple sites)</option>
              <option value="cloudflare-pages">Cloudflare Pages project</option>
              <option value="external">External — record only</option>
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              A Worker can serve <strong>many custom domains</strong>, so one Worker for several sites is cheaper to run than one Pages project per site.
              Domains and build settings are managed through the matching Cloudflare API.
            </p>
          </div>
          <div>
            <label class="${LABEL}">Worker name / Pages project</label>
            <input id="site-project" class="${INPUT}" placeholder="arwes-docs" />
          </div>
          <div>
            <label class="${LABEL}">Deploy Hook URL</label>
            <input id="site-hook" class="${INPUT}" placeholder="https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/…" />
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Worker: Settings → Builds → Deploy Hooks (<code>/workers/builds/deploy_hooks/…</code>).
              Pages: Settings → Builds (<code>/pages/webhooks/deploy_hooks/…</code>). The CMS rejects a mismatched hook.
            </p>
          </div>
          <div>
            <label class="${LABEL}">Git repository</label>
            <input id="site-repo" class="${INPUT}" placeholder="owner/repo" />
          </div>
          <div>
            <label class="${LABEL}">Git branch</label>
            <input id="site-branch" class="${INPUT}" value="main" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label class="${LABEL}">Build command</label>
            <input id="site-build-command" class="${INPUT}" placeholder="npm run build" />
          </div>
          <div>
            <label class="${LABEL}">Deploy command <span class="font-normal text-zinc-500 dark:text-zinc-400">(Worker)</span></label>
            <input id="site-deploy-command" class="${INPUT}" placeholder="npx wrangler deploy" />
          </div>
          <div>
            <label class="${LABEL}">Output directory <span class="font-normal text-zinc-500 dark:text-zinc-400">(Pages)</span></label>
            <input id="site-output-dir" class="${INPUT}" placeholder="apps/docs/build" />
          </div>
          <div>
            <label class="${LABEL}">Root directory</label>
            <input id="site-root-dir" class="${INPUT}" placeholder="/" />
          </div>
        </div>

        <div>
          <label class="${LABEL}">Description</label>
          <input id="site-description" class="${INPUT}" placeholder="Documentation site" />
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-zinc-950/5 dark:border-white/10">
          <div id="create-result" class="text-sm"></div>
          <div class="flex items-center gap-2">
            <a href="/admin/sites" class="${SECONDARY_BTN}">Cancel</a>
            <button onclick="createSite()" class="${PRIMARY_BTN}">Register site</button>
          </div>
        </div>
      </div>
    </div>

    <script>
      function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }

      async function createSite() {
        var result = document.getElementById('create-result');
        result.className = 'text-sm text-zinc-500 dark:text-zinc-400';
        result.textContent = 'Saving...';
        try {
          var response = await fetch('/admin/sites/api/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: val('site-name'),
              slug: val('site-slug'),
              description: val('site-description'),
              provider: val('site-provider'),
              cfProjectName: val('site-project'),
              deployHookUrl: val('site-hook'),
              gitRepo: val('site-repo'),
              gitBranch: val('site-branch'),
              buildCommand: val('site-build-command'),
              deployCommand: val('site-deploy-command'),
              outputDir: val('site-output-dir'),
              rootDir: val('site-root-dir')
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
  const { site, domains } = data

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

  const content = `
    <div class="space-y-6 max-w-4xl">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <a href="/admin/sites" class="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">Sites</a>
            <span class="text-zinc-300 dark:text-zinc-600">/</span>
            <h1 class="text-xl font-semibold text-zinc-950 dark:text-white">${escapeHtml(site.name)}</h1>
            ${buildBadge(site)}
          </div>
          <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400"><code>${escapeHtml(site.slug)}</code></p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="triggerBuild(this)" class="${SECONDARY_BTN}" ${site.deployHookUrl ? '' : 'disabled title="No Deploy Hook URL configured"'}>Build now</button>
        </div>
      </div>

      <div id="action-result" class="text-sm"></div>

      ${credentialsBanner(data.credentials)}

      <!-- Build -->
      <div class="${CARD} p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Builds</h2>
          <button onclick="refreshDeployments(this)" class="${SECONDARY_BTN}">Refresh deployments</button>
        </div>
        <dl class="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 text-xs">
          <div class="flex justify-between gap-4"><dt class="text-zinc-500 dark:text-zinc-400">Last triggered</dt><dd class="text-zinc-900 dark:text-zinc-100">${escapeHtml(fmtTime(site.lastBuildAt))}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-zinc-500 dark:text-zinc-400">Status</dt><dd class="text-zinc-900 dark:text-zinc-100">${escapeHtml(site.lastBuildStatus || '—')}</dd></div>
        </dl>
        ${site.lastBuildError ? `<p class="mt-3 rounded-lg bg-red-50 dark:bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">${escapeHtml(site.lastBuildError)}</p>` : ''}
        <p class="mt-4 text-xs text-zinc-500 dark:text-zinc-400">Cloudflare Pages performs the build; the CMS only triggers it through the Deploy Hook.</p>
        <div id="deployments" class="mt-4">${deploymentRows}</div>
      </div>

      <!-- Domains -->
      <div class="${CARD} p-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Domain bindings</h2>
          <button onclick="refreshDomains(this)" class="${SECONDARY_BTN}" ${data.credentials.configured ? '' : 'disabled'}>Refresh from Cloudflare</button>
        </div>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full text-left">
            <thead class="text-xs uppercase text-zinc-500 dark:text-zinc-400">
              <tr><th class="px-4 py-2 font-medium">Hostname</th><th class="px-4 py-2 font-medium">Status</th><th class="px-4 py-2 font-medium">Validation</th><th class="px-4 py-2"></th></tr>
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
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">The domain is attached to the Pages project through the Cloudflare API; DNS still has to point at the project for it to become active.</p>
      </div>

      <!-- Settings -->
      <div class="${CARD} p-6 space-y-5">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Site settings</h2>
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div><label class="${LABEL}">Name</label><input id="s-name" class="${INPUT}" value="${escapeHtml(site.name)}" /></div>
          <div><label class="${LABEL}">Slug</label><input id="s-slug" class="${INPUT}" value="${escapeHtml(site.slug)}" /></div>
          <div class="sm:col-span-2">
            <label class="${LABEL}">Hosting provider</label>
            <select id="s-provider" class="${INPUT}">
              <option value="cloudflare-worker" ${site.provider === 'cloudflare-worker' ? 'selected' : ''}>Cloudflare Worker + static assets</option>
              <option value="cloudflare-pages" ${site.provider === 'cloudflare-pages' ? 'selected' : ''}>Cloudflare Pages project</option>
              <option value="external" ${site.provider === 'external' ? 'selected' : ''}>External — record only</option>
            </select>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Changing this switches which Cloudflare API is used for domains and build settings; existing bindings are not migrated automatically.
            </p>
          </div>
          <div><label class="${LABEL}">Worker name / Pages project</label><input id="s-project" class="${INPUT}" value="${escapeHtml(site.cfProjectName || '')}" /></div>
          <div><label class="${LABEL}">Git branch</label><input id="s-branch" class="${INPUT}" value="${escapeHtml(site.gitBranch || '')}" /></div>
          <div class="sm:col-span-2"><label class="${LABEL}">Deploy Hook URL</label><input id="s-hook" class="${INPUT}" value="${escapeHtml(site.deployHookUrl || '')}" /></div>
          <div class="sm:col-span-2"><label class="${LABEL}">Git repository</label><input id="s-repo" class="${INPUT}" value="${escapeHtml(site.gitRepo || '')}" /></div>
          <div><label class="${LABEL}">Build command</label><input id="s-build" class="${INPUT}" value="${escapeHtml(site.buildCommand || '')}" /></div>
          <div><label class="${LABEL}">Deploy command <span class="font-normal text-zinc-500 dark:text-zinc-400">(Worker)</span></label><input id="s-deploy" class="${INPUT}" value="${escapeHtml(site.deployCommand || '')}" placeholder="npx wrangler deploy" /></div>
          <div><label class="${LABEL}">Output directory <span class="font-normal text-zinc-500 dark:text-zinc-400">(Pages)</span></label><input id="s-output" class="${INPUT}" value="${escapeHtml(site.outputDir || '')}" /></div>
          <div><label class="${LABEL}">Root directory</label><input id="s-root" class="${INPUT}" value="${escapeHtml(site.rootDir || '')}" /></div>
          <div><label class="${LABEL}">Content prefix</label><input id="s-prefix" class="${INPUT}" value="${escapeHtml(site.contentPrefix || '')}" placeholder="docs" /></div>
          <div><label class="${LABEL}">Pinned Cloudflare zone id <span class="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span></label><input id="s-zone" class="${INPUT}" value="${escapeHtml(site.cfZoneId || '')}" placeholder="auto-detected from the hostname" /></div>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" id="s-active" ${site.isActive ? 'checked' : ''} class="rounded border-zinc-300 dark:border-white/20" />
          Active (inactive sites cannot be built)
        </label>
        <div class="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-950/5 dark:border-white/10">
          <div id="settings-result" class="text-sm"></div>
          <div class="flex items-center gap-2">
            <button onclick="syncBuildConfig(this)" class="${SECONDARY_BTN}" ${data.credentials.configured ? '' : 'disabled'}>Push build config to Cloudflare</button>
            <button onclick="saveSite(this)" class="${PRIMARY_BTN}">Save changes</button>
          </div>
        </div>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">Build config was last pushed ${escapeHtml(fmtTime(site.buildConfigSyncedAt))}.</p>
      </div>

      <!-- Content -->
      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">Content</h2>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          ${data.contentOwned} content item${data.contentOwned === 1 ? '' : 's'} owned by this site ·
          ${data.contentShared} shared item${data.contentShared === 1 ? '' : 's'} readable by every site.
        </p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Ownership is stored on <code>content.site_id</code>; shared content has no site.</p>
      </div>

      <!-- Danger -->
      <div class="${CARD} p-6">
        <h2 class="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h2>
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Unregistering removes the site and its domain records from the CMS. Cloudflare Pages itself is left untouched.</p>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button onclick="deleteSite(this)" class="${SECONDARY_BTN}">Unregister site</button>
          <div id="delete-result" class="text-sm"></div>
        </div>
      </div>
    </div>

    <script>
      var SITE_ID = ${JSON.stringify(site.id)};
      var SITE_SLUG = ${JSON.stringify(site.slug)};

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

      async function triggerBuild(button) {
        if (button) { button.disabled = true; button.textContent = 'Triggering...'; }
        var data = await call('/admin/sites/api/sites/' + SITE_ID + '/build', { method: 'POST' }, 'action-result',
          'Build queued on Cloudflare Pages. Refresh deployments in a minute.');
        if (button) { button.disabled = false; button.textContent = 'Build now'; }
        if (!data) return;
        setTimeout(function () { location.reload(); }, 2500);
      }

      async function saveSite(button) {
        if (button) button.disabled = true;
        var payload = {
          name: val('s-name'), slug: val('s-slug'),
          provider: val('s-provider'),
          cfProjectName: val('s-project'),
          gitBranch: val('s-branch'), deployHookUrl: val('s-hook'), gitRepo: val('s-repo'),
          buildCommand: val('s-build'), deployCommand: val('s-deploy'),
          outputDir: val('s-output'), rootDir: val('s-root'),
          contentPrefix: val('s-prefix'), cfZoneId: val('s-zone'),
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
        await call('/admin/sites/api/sites/' + SITE_ID + '/sync-build-config', { method: 'POST' }, 'settings-result',
          'Build config pushed to Cloudflare Pages');
        if (button) button.disabled = false;
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
