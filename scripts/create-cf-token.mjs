#!/usr/bin/env node
/**
 * Mint a Cloudflare API token from a *bootstrap* token.
 *
 * Why this exists
 * ---------------
 * The dashboard's pre-filled token URL carries short permission *keys*, and the
 * form silently drops keys it does not recognise. One required permission
 * ("Cloudflare Pages") cannot be pre-filled that way at all — established by
 * testing every plausible spelling against the rendered form — which left a
 * manual step in an otherwise automated setup, and made a token that looked fine
 * fail later at deploy time.
 *
 * The API takes permission-group **UUIDs** instead, and those can be resolved
 * from the account at run time *by name*. So: create one bootstrap token by hand
 * (the only step that cannot be automated), then mint every other token on
 * demand, with an explicit expiry and exactly the permissions the job needs.
 *
 * Bootstrap token: user-scoped, permission "API Tokens Write"
 * (com.cloudflare.api.user). Create it in the dashboard under
 * 个人资料 → API 令牌 → 创建令牌 → 权限：API Tokens → 编辑（用户级）.
 *
 * Usage
 *   CF_BOOTSTRAP_TOKEN=... node scripts/create-cf-token.mjs ci
 *   CF_BOOTSTRAP_TOKEN=... node scripts/create-cf-token.mjs runtime --ttl-days 90
 *   ... --no-expiry          token never expires (default: 365 days)
 *   ... --no-secret          only print the token, do not write the GitHub secret
 *   ... --dry-run            resolve everything, create nothing
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATE_FILE = join(ROOT, 'node_modules', '.oauth-state.json')
const API = 'https://api.cloudflare.com/client/v4'

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/**
 * What each token is for, in the names Cloudflare reports through
 * `GET /user/tokens/permission_groups` (English API names — the console may
 * localise them, e.g. "Workers 构建配置" for "Workers CI Write").
 *
 * Account-scoped groups go in one policy, zone-scoped ones in another, because
 * the policy resource differs.
 */
const TOKEN_SPECS = {
  ci: {
    secretName: 'CF_API_TOKEN',
    tokenName: 'Sci-Fi CMS Deploy (CI)',
    purpose: 'wrangler deploy、D1 迁移、secret put、直传部署、绑定自定义域名',
    account: [
      'Workers Scripts Write',
      'Workers KV Storage Write',
      'Workers R2 Storage Write',
      'D1 Write',
      'Account Settings Read',
      'Workers CI Write',
      'Pages Write'
    ],
    zone: ['Workers Routes Write', 'Zone Read', 'DNS Write']
  },
  runtime: {
    secretName: 'CF_SITES_API_TOKEN',
    tokenName: 'Sci-Fi CMS Runtime (sites)',
    purpose: 'CMS Worker 管理自定义域名、触发构建、下发构建环境变量',
    account: ['Workers Scripts Read', 'Workers CI Write', 'Pages Write'],
    zone: ['Workers Routes Write', 'Zone Read']
  }
}

// ---------------------------------------------------------------- args --------
const argv = process.argv.slice(2)
const templateId = (argv.find((a) => !a.startsWith('-')) || '').trim()
if (!TOKEN_SPECS[templateId]) {
  fail(
    `用法：node scripts/create-cf-token.mjs <${Object.keys(TOKEN_SPECS).join('|')}> [--ttl-days N] [--no-expiry] [--no-secret] [--print-token] [--dry-run]`
  )
}
const spec = TOKEN_SPECS[templateId]
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const ttlDays = Number(value('ttl-days', '365'))
const dryRun = flag('dry-run')
const printToken = flag('print-token')
const writeSecret = !flag('no-secret') && !printToken
// Tokens contain no whitespace, but a value copied out of a browser or pasted
// into a secret can arrive with an embedded newline. A newline inside a header
// value makes Cloudflare answer HTTP 400 "Invalid request headers", which reads
// like a permissions problem and sent us looking in the wrong place once.
const rawBootstrap = process.env.CF_BOOTSTRAP_TOKEN || ''
const bootstrap = rawBootstrap.replace(/\s+/g, '')
if (rawBootstrap && !bootstrap) fail('CF_BOOTSTRAP_TOKEN 只有空白字符，请重新复制 token')
if (rawBootstrap !== bootstrap) {
  console.log(
    `  note: CF_BOOTSTRAP_TOKEN 含 ${rawBootstrap.length - bootstrap.length} 个空白字符，已自动去除（这类字符会让 Cloudflare 返回 400 Invalid request headers）`
  )
}

if (!bootstrap) {
  // The bootstrap token is the one thing that cannot be minted, so make creating
  // it as cheap as possible: a pre-filled dashboard URL (the "api_tokens" key is
  // accepted by the form — verified) plus the exact manual path.
  let url = ''
  try {
    const { buildTokenTemplateUrl } = await import('./lib/cf-token-template.mjs')
    url = buildTokenTemplateUrl('bootstrap', { accountId: process.env.CF_ACCOUNT_ID || '' })
  } catch {
    // The URL is a convenience; the manual path below always works.
  }
  fail(
    '未提供引导 token。设置 CF_BOOTSTRAP_TOKEN 后重跑：\n' +
      '  $env:CF_BOOTSTRAP_TOKEN = "<token>"; node scripts/create-cf-token.mjs ' +
      templateId +
      '\n\n' +
      (url ? `一键创建（已预填 API Tokens 编辑权限）：\n  ${url}\n\n` : '') +
      '手动创建：个人资料 → API 令牌 → 创建令牌 → 权限：API Tokens → 编辑（用户级）'
  )
}

const cf = async (path, init = {}) => {
  const res = await fetch(`${API}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${bootstrap}`,
      'Content-Type': 'application/json',
      'User-Agent': 'sci-fi-cms-token-mint'
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) })
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    const detail = (json.errors ?? []).map((e) => e.message || `code ${e.code}`).join('; ')
    throw new Error(
      `${init.method || 'GET'} ${path} → HTTP ${res.status}${detail ? `: ${detail}` : ''}`
    )
  }
  return json.result
}

// ------------------------------------------------- 1) resolve permission ids --
console.log('[1/4] 解析权限组（按名字 → UUID）...')
let groups
try {
  // Account-owned tokens: the permission catalogue is account-scoped, so resolve
  // the account first and hand it to the later step through the environment.
  let catalogueAccount = (process.env.CF_ACCOUNT_ID || '').trim()
  if (!catalogueAccount) {
    const visible = await cf('/accounts')
    if (!visible || visible.length !== 1) {
      fail(
        `需要恰好一个可见账号（或设置 CF_ACCOUNT_ID）。当前可见 ${visible ? visible.length : 0} 个。`
      )
    }
    catalogueAccount = visible[0].id
    process.env.CF_ACCOUNT_ID = catalogueAccount
  }
  groups = await cf(`/accounts/${catalogueAccount}/tokens/permission_groups?limit=500`)
} catch (error) {
  fail(
    `无法读取权限组：${error.message}\n` +
      '  引导 token 需要用户级 “API Tokens Write”（以及读取该列表的能力）。'
  )
}
const byName = new Map((groups ?? []).map((g) => [g.name, g]))
const resolve = (names, scope) => {
  const found = []
  const missing = []
  for (const name of names) {
    const group = byName.get(name)
    if (!group) missing.push(name)
    else found.push({ id: group.id, name })
  }
  if (missing.length > 0) {
    fail(
      `Cloudflare 不再提供这些权限名（${scope}）：${missing.join(', ')}\n` +
        '  说明上游改名了；请对照 https://developers.cloudflare.com/fundamentals/api/reference/permissions/ 更新 TOKEN_SPECS。'
    )
  }
  return found
}
const accountGroups = resolve(spec.account, 'account')
const zoneGroups = resolve(spec.zone, 'zone')
for (const g of [...accountGroups, ...zoneGroups]) console.log(`  ✓ ${g.name}`)

// ------------------------------------------------------- 2) resolve account ---
console.log('[2/4] 解析账号 ...')
let accountId = (process.env.CF_ACCOUNT_ID || '').trim()
if (!accountId) {
  const accounts = await cf('/accounts')
  if (!accounts || accounts.length !== 1) {
    fail(
      `需要恰好一个可见账号（或设置 CF_ACCOUNT_ID）。当前可见 ${accounts ? accounts.length : 0} 个。`
    )
  }
  accountId = accounts[0].id
}
console.log(`  ✓ ${accountId}`)

// --------------------------------------------------------- 3) build request ---
const policies = [
  {
    effect: 'allow',
    resources: { [`com.cloudflare.api.account.${accountId}`]: '*' },
    permission_groups: accountGroups.map((g) => ({ id: g.id }))
  },
  {
    effect: 'allow',
    // Every zone in the account: the CMS resolves the zone per hostname at bind
    // time, so pinning a single zone here would break multi-domain sites.
    resources: {
      [`com.cloudflare.api.account.${accountId}`]: { 'com.cloudflare.api.account.zone.*': '*' }
    },
    permission_groups: zoneGroups.map((g) => ({ id: g.id }))
  }
]
const body = { name: spec.tokenName, policies }
if (!flag('no-expiry')) {
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) fail(`--ttl-days 需要一个正数，收到 ${ttlDays}`)
  body.expires_on = new Date(Date.now() + ttlDays * 86400000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
}
console.log('[3/4] 准备创建 ...')
console.log(`  名称: ${body.name}`)
console.log(`  有效期: ${body.expires_on ? body.expires_on.slice(0, 10) : '永不过期'}`)
console.log(`  账号级权限 ${accountGroups.length} 项 / 区域级权限 ${zoneGroups.length} 项`)

if (dryRun) {
  console.log('\n--dry-run：未创建任何 token。')
  process.exit(0)
}

let created
try {
  created = await cf(`/accounts/${accountId}/tokens`, { method: 'POST', body })
} catch (error) {
  fail(`创建失败：${error.message}`)
}
const tokenValue = created?.value
if (!tokenValue) fail('Cloudflare 未返回 token 值（响应缺少 value 字段）')

// Machine-readable hand-off for CI. The workflow greps the `__TOKEN__` line, so
// the progress output above cannot be mistaken for the value; nothing is written
// to GitHub secrets in this mode (the runner has no .oauth-state.json anyway).
if (printToken) {
  console.log(`__TOKEN__${tokenValue}`)
  process.exit(0)
}

console.log(`[4/4] 已创建: id=${created.id}  前缀=${String(tokenValue).slice(0, 8)}…`)

// ------------------------------------------------------- 4) write the secret --
if (!writeSecret) {
  console.log(`\n（--no-secret）token 值：\n${tokenValue}`)
  process.exit(0)
}

if (!existsSync(STATE_FILE)) {
  console.log(`\n未找到 ${STATE_FILE}，无法写 GitHub secret。token 值：\n${tokenValue}`)
  process.exit(0)
}
const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
const gh = state.github
if (!gh?.token || !gh?.repo) {
  console.log(`\n.oauth-state.json 缺少 GitHub 凭据，未写 secret。token 值：\n${tokenValue}`)
  process.exit(0)
}

const sodium = (await import('libsodium-wrappers')).default
await sodium.ready
const ghHeaders = {
  Authorization: `Bearer ${gh.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
}
const { key_id: keyId, key: pubKeyB64 } = await (
  await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/public-key`, {
    headers: ghHeaders
  })
).json()
const pubKey = sodium.from_base64(pubKeyB64, sodium.base64_variants.ORIGINAL)
const seal = (value) =>
  sodium.to_base64(
    sodium.crypto_box_seal(new Uint8Array(Buffer.from(value)), pubKey),
    sodium.base64_variants.ORIGINAL
  )

for (const [name, val] of [
  [spec.secretName, tokenValue],
  ['CF_ACCOUNT_ID', accountId]
]) {
  const res = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: seal(val), key_id: keyId })
  })
  if (!res.ok && res.status !== 204 && res.status !== 201)
    fail(`写入 ${name} 失败：HTTP ${res.status}`)
  console.log(`  ✓ GitHub secret ${name} 已更新`)
}

console.log(
  `\n✅ 完成。${spec.tokenName}（${spec.purpose}）已创建并写入 ${spec.secretName}` +
    `，有效期 ${body.expires_on ? body.expires_on.slice(0, 10) : '永不过期'}。\n` +
    '   引导 token（API Tokens Write）请妥善保管：它是后续按需生成 token 的唯一入口。'
)
