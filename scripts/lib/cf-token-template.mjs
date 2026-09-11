/**
 * Cloudflare API token template URLs, plus verification helpers.
 *
 * Why: Cloudflare's dashboard accepts pre-filled token creation URLs, so the
 * "create a token" step can be a single click instead of hand-picking a dozen
 * permission rows. Format per the Cloudflare docs:
 *
 *   https://dash.cloudflare.com/profile/api-tokens
 *     ?permissionGroupKeys=[{"key":"...","type":"read|edit"}]
 *     &accountId=*&zoneId=all&name=Token+Name
 *
 * See https://developers.cloudflare.com/fundamentals/api/how-to/account-owned-token-template/
 *
 * Two tokens are needed by this project and they are NOT interchangeable:
 *
 *   * `ci`      — used by the GitHub Actions deploy job (`wrangler deploy`,
 *                 `wrangler d1 migrations apply`, `wrangler secret put`).
 *                 Stored as the `CF_API_TOKEN` GitHub secret. Must be a
 *                 long-lived API token: an OAuth access token lives 1 hour,
 *                 which is what made the pipeline fail roughly hourly.
 *   * `runtime` — used by the deployed CMS Worker to manage custom domains and
 *                 Workers Builds. Stored on the Worker (Admin → Sites, or a
 *                 Worker secret). The Workers Builds API only accepts a
 *                 user-scoped token.
 */

/** Dashboard page the template URLs open. */
export const USER_TOKEN_PAGE = 'https://dash.cloudflare.com/profile/api-tokens'

/**
 * Permission keys come from the published template-URL reference. Where a key is
 * not published, `inferred: true` marks it so the UI can tell the user to double
 * check that row on the dashboard page rather than trusting the pre-fill.
 */
export const TOKEN_TEMPLATES = {
  ci: {
    label: 'Cloudflare CI / 部署 token',
    purpose: 'wrangler deploy、d1 migrations apply、secret put（GitHub secret CF_API_TOKEN）',
    tokenName: 'Flare CMS Deploy (CI)',
    permissions: [
      { key: 'workers_scripts', type: 'edit' },
      { key: 'd1', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_r2', type: 'edit' }
    ],
    checklist: [
      'Workers Scripts: Edit',
      'D1: Edit',
      'Workers KV Storage: Edit',
      'Workers R2 Storage: Edit（不用 R2 可去掉）'
    ]
  },
  runtime: {
    label: 'Cloudflare Runtime token（CMS 管理域名/构建）',
    purpose: 'CMS Worker 管理自定义域名与 Workers Builds（必须 user-scoped）',
    tokenName: 'Flare CMS Runtime (sites)',
    permissions: [
      { key: 'workers_scripts', type: 'read' },
      { key: 'zone', type: 'read' },
      // The permissions reference lists this permission as "Workers CI"
      // (Cloudflare's name for Workers Builds) but publishes no key for it.
      // Keys follow the snake_case display name, so this is the expected value
      // — flagged as inferred so the UI asks the user to confirm the row.
      { key: 'workers_ci', type: 'edit', inferred: true }
    ],
    checklist: [
      'Workers Scripts: Read',
      'Zone: Read',
      'Workers CI: Edit（即 Workers Builds；这个 key 官方未公布，请在页面上确认已勾选）'
    ]
  }
}

/**
 * Build the dashboard URL that opens the token form with permissions pre-filled.
 *
 * @param {'ci'|'runtime'} templateId
 * @param {{ accountId?: string, tokenName?: string }} [options]
 *   `accountId` scopes the token to one account; omit or pass `*` for all.
 */
export function buildTokenTemplateUrl(templateId, options = {}) {
  const template = TOKEN_TEMPLATES[templateId]
  if (!template) throw new Error(`Unknown token template: ${templateId}`)

  const permissions = JSON.stringify(template.permissions.map(({ key, type }) => ({ key, type })))

  const params = new URLSearchParams({
    permissionGroupKeys: permissions,
    accountId: options.accountId?.trim() || '*',
    zoneId: 'all',
    name: options.tokenName?.trim() || template.tokenName
  })

  return `${USER_TOKEN_PAGE}?${params.toString()}`
}

/**
 * Open a URL in the default browser.
 *
 * Uses execFile with an argument array rather than a shell string: these URLs
 * contain `&`, which `cmd /c start` would otherwise treat as a command
 * separator.
 */
export async function openUrl(url) {
  const { execFile } = await import('node:child_process')
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]

  return await new Promise((resolve) => {
    try {
      execFile(command, args, { stdio: 'ignore' }, (error) => resolve(!error))
    } catch {
      resolve(false)
    }
  })
}

/** Permission lines to show the user so they can eyeball the form. */
export function tokenChecklist(templateId) {
  const template = TOKEN_TEMPLATES[templateId]
  if (!template) throw new Error(`Unknown token template: ${templateId}`)
  return template.checklist.slice()
}

/** Verify a token with Cloudflare. Never throws. */
export async function verifyCfToken(token) {
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok && json.success === true,
      status: json.result?.status ?? null,
      httpStatus: res.status,
      errors: json.errors ?? []
    }
  } catch (error) {
    return { ok: false, status: null, httpStatus: 0, errors: [{ message: String(error) }] }
  }
}

/**
 * List the accounts a token can see.
 *
 * Advisory only: a token that is valid and perfectly able to deploy can still be
 * unable to call `GET /accounts`, so callers must not treat a failure here as a
 * bad token.
 */
export async function listCfAccounts(token) {
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.success !== true) {
      return { ok: false, accounts: [], errors: json.errors ?? [] }
    }
    return { ok: true, accounts: json.result ?? [], errors: [] }
  } catch (error) {
    return { ok: false, accounts: [], errors: [{ message: String(error) }] }
  }
}
