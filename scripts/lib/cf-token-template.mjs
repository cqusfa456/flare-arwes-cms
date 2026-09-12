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
 * Permission names and scopes are documented at
 * https://developers.cloudflare.com/fundamentals/api/reference/permissions/ —
 * note that this reference contains two naming generations (e.g. "Cloudflare
 * Pages: Edit" and an older "Pages Read/Write"). The template URL carries
 * *keys*, not names, and the token form silently drops keys it does not
 * recognise, so when in doubt ask the API for the truth:
 *   GET /user/tokens/permission_groups   → id (= key), name, scopes
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
  bootstrap: {
    // Account-owned (service principal) token: created from the account token
    // page, permission key is account-scoped, and the URL format carries no
    // accountId/zoneId. Web OAuth cannot create these — Cloudflare's OAuth
    // allow-list rejects every token-management scope (measured: invalid_scope
    // for account_api_tokens:write/edit, api_tokens:write, tokens:write and
    // account_api_tokens:read), so this one token is the only manual step.
    accountLevel: true,
    label: 'Cloudflare 账户级 bootstrap token（用来按需生成其他 token）',
    purpose:
      '调用 POST /accounts/{id}/tokens 生成部署 / 运行时 token；这是唯一必须手动创建的 token，且属于账户而非个人，不随人员变动失效',
    tokenName: 'Sci-Fi CMS Bootstrap (account)',
    permissions: [{ key: 'account_api_tokens', type: 'edit' }],
    checklist: [
      '需在**账户级**页面创建（Manage Account → Account API Tokens），要求 Super Administrator',
      'API 令牌：「编辑」（账户级，英文名 “API Tokens Write”）—— 键名 account_api_tokens',
      '值形如 cfat_…（账户级 token 的可扫描前缀），创建后只显示一次',
      '⚠ 该键能否在表单里预填尚未实测：若名称为空或权限行没出现，请手动选「帐户 → 权限 → API 令牌 → 编辑」'
    ]
  },
  ci: {
    label: 'Cloudflare CI / 部署 token',
    purpose:
      'wrangler deploy、d1 migrations apply、secret put，以及绑定自定义域名（GitHub secret CF_API_TOKEN）',
    tokenName: 'Sci-Fi CMS Deploy (CI)',
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
      // set — so without these the fallback path could not push a build
      // environment, trigger a build, or deploy a Pages project.
      //
      // Workers Builds ("Workers 构建配置" / "Workers CI Write", account scope).
      { key: 'workers_ci', type: 'edit', inferred: true },
      // API Tokens (user scope). The deploy workflow uses this CI token as the
      // bootstrap for scripts/create-cf-token.mjs, so it can mint the scoped
      // runtime token the CMS is given — no second hand-made token, and the
      // Worker never holds the broad CI token.
      { key: 'api_tokens', type: 'edit' }
      // "Cloudflare Pages" ("Pages Write", account scope, id
      // 8d28297797f24fb8a0c332fe0866ec89) is deliberately NOT listed: it cannot
      // be pre-filled through this URL. Verified against the rendered form, one
      // candidate at a time — pages:edit, pages:write, cloudflare_pages:edit,
      // cloudflare_pages:write and the group's UUID were all ignored, while the
      // same page pre-filled the other nine rows. The checklist below therefore
      // tells the operator to add that single row by hand.
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
      'Workers 构建配置：「编辑」（= Workers CI Write，**账户级**；链接已预填）',
      'API Tokens：「编辑」（= API Tokens Write，**用户级**）—— 部署时用它换取 CMS 运行时 token，无需再手工建第二只 token',
      '⚠ Cloudflare Pages：「编辑」（= Pages Write，**账户级**）—— **这一行无法通过链接预填，必须手动加**：点「添加更多」→ 资源选「帐户」→ 权限选「Cloudflare Pages」→ 级别选「编辑」。不做 Pages 部署可跳过'
    ]
  },
  runtime: {
    label: 'Cloudflare Runtime token（CMS 管理域名/构建）',
    purpose:
      'CMS Worker 管理自定义域名、Workers Builds 与构建环境变量（必须 user-scoped；存为 GitHub secret CF_SITES_API_TOKEN 或直接填进 Admin → Sites）',
    tokenName: 'Sci-Fi CMS Runtime (sites)',
    permissions: [
      { key: 'workers_scripts', type: 'read' },
      { key: 'zone', type: 'read' },
      // Bind / unbind Worker custom domains.
      { key: 'workers_routes', type: 'edit' },
      // One type only: the form treats each (key, type) pair as its own row, so
      // listing several types for one permission pre-fills duplicate rows
      // (observed with workers_ci before this was fixed). Pages is not listed at
      // all — it cannot be pre-filled; see the ci preset for the evidence.
      { key: 'workers_ci', type: 'edit', inferred: true }
    ],
    checklist: [
      'Workers Scripts: Read（解析 Worker tag）',
      'Zone: Read（按主机名解析所属 zone）',
      'Workers Routes: Edit（绑定/解绑自定义域名）',
      'Workers 构建配置：「编辑」（= Workers CI Write，**账户级**；链接已预填）',
      '⚠ Cloudflare Pages：「编辑」（= Pages Write，**账户级**）—— **无法通过链接预填，必须手动加**：资源选「帐户」→ 权限选「Cloudflare Pages」→ 级别选「编辑」。仅当还用 CMS 管理 Pages 站点时需要'
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
    ...(template.accountLevel
      ? {}
      : { accountId: options.accountId?.trim() || '*', zoneId: 'all' }),
    name: options.tokenName?.trim() || template.tokenName
  })

  // URLSearchParams encodes a space as "+", but the dashboard decodes the name
  // with a plain percent-decoder, so "Sci-Fi+CMS+Bootstrap" was not recognised
  // as the token name and the field came up empty. The documented examples use
  // %20 (name=Custom%20Token), so re-encode spaces instead. A literal plus in a
  // value would already be %2B, so this cannot corrupt anything.
  const query = params.toString().replace(/\+/g, '%20')

  // Account-owned tokens live on the account page and take no accountId/zoneId.
  return template.accountLevel
    ? `https://dash.cloudflare.com/?to=/:account/api-tokens&${query}`
    : `${USER_TOKEN_PAGE}?${query}`
}

/**
 * Open a URL in the default browser.
 *
 * Windows must NOT go through `cmd /c start`: cmd re-parses its own command
 * line, so the `%` in this URL's percent-encoding is expanded as a variable and
 * the first unquoted `&` starts a new command. The dashboard then received a
 * mangled URL (no permissions, no name) even though the printed URL was correct —
 * which is exactly the "nothing was pre-filled" report. Passing an argv array to
 * execFile does not help, because the mangling happens inside cmd.
 *
 * `rundll32 url.dll,FileProtocolHandler` is handed the URL by CreateProcess and
 * spawns the browser through ShellExecute, so no shell ever parses it.
 */
export async function openUrl(url) {
  const { execFile } = await import('node:child_process')
  const [command, args] =
    process.platform === 'win32'
      ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
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
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'sci-fi-cms-token-check' }
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
