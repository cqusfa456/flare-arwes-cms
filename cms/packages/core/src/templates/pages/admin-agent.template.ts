/**
 * Admin → Agent 接入 page.
 *
 * A single link an agent can be handed: its document carries the API guide and the
 * token. The page itself is mostly explaining that, plus the two things an operator
 * needs to be able to do — refresh the link and revoke it.
 */

import { renderAdminLayoutCatalyst } from '../layouts/admin-layout-catalyst.template'
import { t } from '../../i18n/admin'
import { icon, Bot, BookOpen, Copy, ExternalLink, RefreshCw, Shield } from '../icons'

export interface AgentPageData {
  /** The onboarding URL, when a usable token exists. */
  link: string | null
  /** Ready-to-paste prompt for an agent. */
  prompt: string | null
  tokenPrefix: string | null
  createdAt: number | null
  lastUsedAt: number | null
  /** True when a stored token exists but no longer works and has to be refreshed. */
  needsRotation: boolean
  /** The document itself, shown as a preview. */
  document: string | null
  /** Where the rest of the CMS documentation lives. */
  docs: { openapi: string; reference: string; info: string; health: string }
  user?: { name: string; email: string; role: string }
  version?: string
}

const CARD =
  'rounded-xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-950/5 dark:ring-white/10'
const LABEL = 'block text-sm/6 font-medium text-zinc-950 dark:text-white mb-2'
const PRIMARY_BTN =
  'inline-flex items-center gap-2 rounded-lg bg-zinc-950 dark:bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50'
const SECONDARY_BTN =
  'inline-flex items-center gap-2 rounded-lg bg-white dark:bg-white/5 px-3.5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 ring-1 ring-inset ring-zinc-950/10 dark:ring-white/15 hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50'

const fmtTime = (value: number | null): string =>
  value === null || value === undefined
    ? '—'
    : new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function renderAgentPage(data: AgentPageData): string {
  const hasLink = !!data.link

  const linkBox = hasLink
    ? `
        <div class="${CARD} p-6 space-y-5">
          <div class="flex items-center gap-2">
            ${icon(Bot, 'h-5 w-5 text-teal-600 dark:text-teal-400')}
            <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">${t('Agent link')}</h2>
            <span class="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">${t('Active')}</span>
          </div>

          <div>
            <label class="${LABEL}">${t('Onboarding link')}</label>
            <div class="flex flex-wrap items-center gap-2">
              <input id="agent-link" readonly value="${escapeHtml(data.link!)}"
                class="flex-1 min-w-72 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-200" />
              <button type="button" onclick="copyValue('agent-link', this)" class="${SECONDARY_BTN}">${icon(Copy, 'h-4 w-4')} ${t('Copy link')}</button>
              <a href="${escapeHtml(data.link!)}" target="_blank" rel="noopener noreferrer" class="${SECONDARY_BTN}">${icon(ExternalLink, 'h-4 w-4')} ${t('Open the document')}</a>
            </div>
            <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              ${t('Hand this link to your agent, or paste it below. Anyone who has it can read and write content through the API, so treat it as a credential.')}
            </p>
          </div>

          <div>
            <label class="${LABEL}">${t('Prompt for the agent')}</label>
            <div class="flex flex-wrap items-start gap-2">
              <textarea id="agent-prompt" readonly rows="2"
                class="flex-1 min-w-72 rounded-lg border border-zinc-950/10 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2 text-xs font-mono text-zinc-700 dark:text-zinc-200">${escapeHtml(data.prompt!)}</textarea>
              <button type="button" onclick="copyValue('agent-prompt', this)" class="${SECONDARY_BTN}">${icon(Copy, 'h-4 w-4')} ${t('Copy prompt')}</button>
            </div>
          </div>

          <dl class="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-3">
            <div class="flex justify-between gap-3"><dt class="text-zinc-500 dark:text-zinc-400">${t('Token')}</dt><dd class="font-mono text-zinc-900 dark:text-zinc-100">${escapeHtml(data.tokenPrefix ?? '—')}…</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-zinc-500 dark:text-zinc-400">${t('Created')}</dt><dd class="text-zinc-900 dark:text-zinc-100">${escapeHtml(fmtTime(data.createdAt))}</dd></div>
            <div class="flex justify-between gap-3"><dt class="text-zinc-500 dark:text-zinc-400">${t('Last used')}</dt><dd class="text-zinc-900 dark:text-zinc-100">${escapeHtml(fmtTime(data.lastUsedAt))}</dd></div>
          </dl>

          <div class="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-950/5 dark:border-white/10">
            <button type="button" onclick="rotateLink(this)" class="${SECONDARY_BTN}">${icon(RefreshCw, 'h-4 w-4')} ${t('Refresh the link')}</button>
            <button type="button" onclick="revokeLink(this)" class="${SECONDARY_BTN} text-red-700 dark:text-red-400">${t('Revoke')}</button>
            <span id="agent-result" class="text-sm text-zinc-500 dark:text-zinc-400"></span>
          </div>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            ${t('Refreshing mints a new token and revokes the old one: links already handed out stop working. The token also shows up under API Tokens, and revoking it there has the same effect.')}
          </p>
        </div>`
    : `
        <div class="${CARD} p-6 space-y-4">
          <div class="flex items-center gap-2">
            ${icon(Bot, 'h-5 w-5 text-zinc-500')}
            <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">${t('Agent link')}</h2>
            ${data.needsRotation ? `<span class="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">${t('The previous token no longer works: refresh the link')}</span>` : ''}
          </div>
          <p class="text-sm text-zinc-600 dark:text-zinc-300">
            ${t('Generate the link to mint a token for it and start handing the CMS to an agent.')}
          </p>
          <div class="flex items-center gap-2">
            <button type="button" onclick="rotateLink(this)" class="${PRIMARY_BTN}">${icon(Bot, 'h-4 w-4')} ${t('Generate the link')}</button>
            <span id="agent-result" class="text-sm text-zinc-500 dark:text-zinc-400"></span>
          </div>
        </div>`

  const document = data.document
    ? `
        <details class="${CARD} p-6">
          <summary class="cursor-pointer text-sm font-semibold text-zinc-950 dark:text-white">${t('What the agent receives')}</summary>
          <pre class="mt-4 max-h-[32rem] overflow-auto rounded-lg bg-zinc-950 dark:bg-black/60 p-4 text-xs leading-relaxed text-zinc-100 whitespace-pre-wrap">${escapeHtml(data.document)}</pre>
        </details>`
    : ''

  const content = `
    <div class="space-y-6 max-w-4xl">
      <div>
        <div class="flex items-center gap-3">
          ${icon(Bot, 'h-7 w-7 text-teal-600 dark:text-teal-400')}
          <h1 class="text-2xl/8 font-semibold text-zinc-950 dark:text-white sm:text-xl/8">${t('Agent onboarding')}</h1>
        </div>
        <p class="mt-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
          ${t('One link carries the API document and an access token, so an agent can start working on this CMS without any manual setup.')}
        </p>
      </div>

      <div class="${CARD} p-6 space-y-3">
        <div class="flex items-center gap-2">
          ${icon(Shield, 'h-5 w-5 text-amber-600 dark:text-amber-400')}
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">${t('Before you share it')}</h2>
        </div>
        <ul class="list-disc pl-5 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <li>${t('The token can read and write every collection: it is the CMS write permission.')}</li>
          <li>${t('Content is published to the sites it is assigned to; a site shows the change once it has been built again.')}</li>
          <li>${t('Do not commit the link to a public repository, and refresh it here if it may have leaked.')}</li>
        </ul>
      </div>

      ${linkBox}

      <div class="${CARD} p-6 space-y-3">
        <div class="flex items-center gap-2">
          ${icon(BookOpen, 'h-5 w-5 text-teal-600 dark:text-teal-400')}
          <h2 class="text-sm font-semibold text-zinc-950 dark:text-white">${t('Other documentation')}</h2>
        </div>
        <p class="text-sm text-zinc-600 dark:text-zinc-300">
          ${t('The link above is the quick start. The details live in these pages, and the agent can read them with the same token.')}
        </p>
        <ul class="space-y-2 text-sm">
          <li class="flex flex-wrap items-center gap-2">
            <a href="${escapeHtml(data.docs.reference)}" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">${t('API reference')}</a>
            <span class="text-zinc-500 dark:text-zinc-400">${t('Every endpoint, with its method, path and description. Scripts read it with X-API-Key.')}</span>
          </li>
          <li class="flex flex-wrap items-center gap-2">
            <a href="${escapeHtml(data.docs.openapi)}" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">${t('OpenAPI specification')}</a>
            <span class="text-zinc-500 dark:text-zinc-400">${t('Machine-readable paths and schemas of the content API.')}</span>
          </li>
          <li class="flex flex-wrap items-center gap-2">
            <a href="${escapeHtml(data.docs.info)}" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">${t('System info')}</a>
            <span class="text-zinc-500 dark:text-zinc-400">${t('Name, version and the capabilities this deployment has turned on.')}</span>
          </li>
          <li class="flex flex-wrap items-center gap-2">
            <a href="${escapeHtml(data.docs.health)}" target="_blank" rel="noopener noreferrer" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">${t('Health check')}</a>
            <span class="text-zinc-500 dark:text-zinc-400">${t('Database, cache and storage availability.')}</span>
          </li>
        </ul>
      </div>

      ${document}
    </div>
  `

  const script = `
    <script>
      function agentResult(message, ok) {
        var el = document.getElementById('agent-result');
        if (!el) return;
        el.className = ok ? 'text-sm text-emerald-600 dark:text-emerald-400' : 'text-sm text-red-600 dark:text-red-400';
        el.textContent = message;
      }

      function copyValue(id, button) {
        var el = document.getElementById(id);
        if (!el) return;
        var value = el.value !== undefined ? el.value : el.textContent;
        var done = function() {
          var original = button.textContent;
          button.textContent = ${JSON.stringify(t('Copied'))};
          setTimeout(function() { button.textContent = original; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done).catch(function() { el.select(); document.execCommand('copy'); done(); });
        } else {
          el.select();
          document.execCommand('copy');
          done();
        }
      }

      async function rotateLink(button) {
        if (button) button.disabled = true;
        agentResult(${JSON.stringify(t('Generating...'))}, true);
        try {
          var res = await fetch('/admin/agent/api/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rotate: true })
          });
          var data = await res.json();
          if (data.success) { location.reload(); return; }
          agentResult(data.error || ${JSON.stringify(t('Could not generate the link'))}, false);
        } catch (error) {
          agentResult(${JSON.stringify(t('Network error'))}, false);
        }
        if (button) button.disabled = false;
      }

      async function revokeLink(button) {
        if (!confirm(${JSON.stringify(t('Revoke the agent link? Tokens and links already handed out stop working.'))})) return;
        if (button) button.disabled = true;
        try {
          var res = await fetch('/admin/agent/api/revoke', { method: 'POST' });
          var data = await res.json();
          if (data.success) { location.reload(); return; }
          agentResult(data.error || ${JSON.stringify(t('Could not revoke the link'))}, false);
        } catch (error) {
          agentResult(${JSON.stringify(t('Network error'))}, false);
        }
        if (button) button.disabled = false;
      }
    </script>
  `

  return renderAdminLayoutCatalyst({
    title: t('Agent onboarding'),
    pageTitle: t('Agent onboarding'),
    currentPath: '/admin/agent',
    content: content + script,
    ...(data.user ? { user: data.user } : {}),
    version: data.version
  })
}
