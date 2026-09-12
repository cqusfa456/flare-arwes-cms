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
 *   * `runtime` — used by the deployed CMS Worker to manage custom domains,
 *                 Workers Builds and each trigger's build environment. Stored as
 *                 the `CF_SITES_API_TOKEN` GitHub secret, which the deploy
 *                 workflow installs on the Worker as `CF_API_TOKEN` (see
 *                 .github/workflows/deploy.yml); it can also be pasted into
 *                 Admin → Sites. The Workers Builds API only accepts a
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
    purpose:
      'wrangler deploy、d1 migrations apply、secret put，以及绑定自定义域名（GitHub secret CF_API_TOKEN）',
    tokenName: 'Flare CMS Deploy (CI)',
    permissions: [
      // Account-scoped: what wrangler needs to deploy and manage resources.
      { key: 'workers_scripts', type: 'edit' },
      { key: 'workers_kv_storage', type: 'edit' },
      { key: 'workers_r2', type: 'edit' },
      { key: 'd1', type: 'edit' },
      { key: 'account_settings', type: 'read' },
      // Zone-scoped. Cloudflare's own "Edit Cloudflare Workers" token template
      // grants Workers Routes (Write) at Zone scope; this is the permission
      // that lets a Worker be attached to a custom domain.
      { key: 'workers_routes', type: 'edit' },
      { key: 'zone', type: 'read' },
      // NOT part of Cloudflare's Workers template: Worker custom domains have
      // Cloudflare create the DNS record internally. Kept because the same
      // token also covers Pages custom domains and direct DNS work.
      { key: 'dns', type: 'edit' },
      // The CMS is the control plane for site builds, and the deploy workflow
      // installs this same token on the Worker when CF_SITES_API_TOKEN is not
      // set — so without these two the fallback path could not push a build
      // environment or trigger a build. Confirm both rows on the dashboard
      // page: Cloudflare publishes no key for either.
      { key: 'workers_ci', type: 'edit', inferred: true },
      { key: 'pages', type: 'edit', inferred: true }
    ],
    checklist: [
      'Workers Scripts: Edit（部署 Worker）',
      'Workers KV Storage: Edit（KV 绑定）',
      'Workers R2 Storage: Edit（R2 媒体桶；不用 R2 可去掉）',
      'D1: Edit（数据库与迁移）',
      'Account Settings: Read（列出账号，用于自动填写 CF_ACCOUNT_ID）',
      'Workers Routes: Edit ← 域级权限，绑定自定义域名必需',
      'Zone: Read（按主机名解析所属 zone）',
      'DNS: Edit（官方 Workers 模板不含此项；Worker 域名由 Cloudflare 自动建 DNS，保留是为了兼顾 Pages 域名或直接改 DNS）',
      'Workers CI: Edit（即 Workers Builds；**官方未公布 key，页面不会预填这一行**，请手动 “Add more” 添加：Workers CI → Edit）',
      'Pages: Edit（**同样不会预填**，请手动添加：Pages → Edit；不做 Pages 部署可跳过）'
    ]
  },
  runtime: {
    label: 'Cloudflare Runtime token（CMS 管理域名/构建）',
    purpose:
      'CMS Worker 管理自定义域名、Workers Builds 与构建环境变量（必须 user-scoped；存为 GitHub secret CF_SITES_API_TOKEN 或直接填进 Admin → Sites）',
    tokenName: 'Flare CMS Runtime (sites)',
    permissions: [
      { key: 'workers_scripts', type: 'read' },
      { key: 'zone', type: 'read' },
      // Bind / unbind Worker custom domains.
      { key: 'workers_routes', type: 'edit' },
      // The permissions reference lists this permission as "Workers CI"
      // (Cloudflare's name for Workers Builds) but publishes no key for it.
      // Keys follow the snake_case display name, so this is the expected value
      // — flagged as inferred so the UI asks the user to confirm the row.
      { key: 'workers_ci', type: 'edit', inferred: true },
      // Only needed when the CMS also manages Cloudflare Pages sites (domains
      // and build config). Same caveat as above: confirm the row on the page.
      { key: 'pages', type: 'edit', inferred: true }
    ],
    checklist: [
      'Workers Scripts: Read（解析 Worker tag）',
      'Zone: Read（按主机名解析所属 zone）',
      'Workers Routes: Edit（绑定/解绑自定义域名）',
      'Workers CI: Edit（即 Workers Builds；触发构建、下发构建环境变量。**官方未公布 key，页面不会预填**，请手动添加）',
      'Pages: Edit（仅当还用 CMS 管理 Pages 站点时。**同样不会预填**，请手动添加）'
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
 * The APIs this project actually depends on, used to *test* a token instead of
 * trusting the pre-filled form.
 *
 * This matters because the template URL cannot express every permission:
 * Cloudflare publishes no permission key for "Workers CI" (Workers Builds) or
 * "Pages", and a page that receives an unknown key silently drops it. A token
 * created from the template URL can therefore still be missing exactly the
 * permission a Pages deploy needs — which is what happened here: the token
 * deployed the CMS and a Worker fine, then failed every Pages call with
 * "Authentication error [code: 10000]".
 */
export const TOKEN_CAPABILITY_PROBES = [
  {
    id: 'workers',
    label: 'Workers Scripts（部署 CMS / 站点 Worker）',
    permission: 'Workers Scripts: Edit',
    path: (accountId) => `/accounts/${accountId}/workers/scripts`
  },
  {
    id: 'pages',
    label: 'Cloudflare Pages（Pages 项目、直传部署、其域名）',
    permission: 'Pages: Edit',
    path: (accountId) => `/accounts/${accountId}/pages/projects`
  },
  {
    id: 'zones',
    label: 'Zone 读取（把自定义域名解析到所属 zone）',
    permission: 'Zone: Read',
    path: () => `/zones?per_page=1`
  }
]

/**
 * Probe each capability the project needs. Never throws; returns one entry per
 * probe with `ok` and, when it failed, the permission to add.
 */
export async function probeTokenCapabilities(token, accountId) {
  const results = []
  for (const probe of TOKEN_CAPABILITY_PROBES) {
    const needsAccount = probe.path('').includes('/accounts/')
    if (needsAccount && !accountId) {
      results.push({
        ...probe,
        ok: null,
        httpStatus: 0,
        errors: [{ message: 'no account id available' }]
      })
      continue
    }
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4${probe.path(accountId)}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'flare-cms-token-check' }
      })
      const json = await res.json().catch(() => ({}))
      results.push({
        ...probe,
        ok: res.ok && json.success !== false,
        httpStatus: res.status,
        errors: json.errors ?? []
      })
    } catch (error) {
      results.push({ ...probe, ok: false, httpStatus: 0, errors: [{ message: String(error) }] })
    }
  }
  return results
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
