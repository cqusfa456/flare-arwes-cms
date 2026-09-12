#!/usr/bin/env node
/**
 * Set ONLY the Cloudflare CI credentials as GitHub Actions secrets.
 *
 * Why this exists
 * ---------------
 * `configure-secrets.mjs` writes the Cloudflare **OAuth access token** into the
 * `CF_API_TOKEN` secret. That token lives for 3599s (60 minutes) — verified from
 * `.oauth-state.json` (`cloudflare.expiresIn`) — so the deploy pipeline works for
 * about an hour after every refresh and then fails with:
 *
 *     ✘ A request to the Cloudflare API (/accounts) failed.
 *       Invalid access token [code: 9109]
 *
 * It also has side effects you probably do not want on a token rotation:
 *   * it generates a NEW random `JWT_SECRET` every run (invalidating all admin
 *     sessions),
 *   * it writes hardcoded D1 / KV / R2 identifiers,
 *   * it overwrites `FLARE_API_URL` and `PAGES_PROJECT_NAME`.
 *
 * This script touches exactly one or two secrets and refuses to write a token
 * that Cloudflare does not accept.
 *
 * Required permissions on the CI token (used by `wrangler deploy`,
 * `wrangler d1 migrations apply --remote` and `wrangler secret put`):
 *   Account:  Workers Scripts: Edit, D1: Edit, Workers KV Storage: Edit
 *             (+ Workers R2 Storage: Edit if you use R2)
 * A long-lived API Token is strongly preferred over an OAuth token: set no
 * expiry (or a long one) so this never has to be refreshed again.
 *
 * Note: this is the CI token. The token the CMS uses at runtime to manage
 * domains and builds is a DIFFERENT secret and needs different scopes (Workers
 * Scripts: Read, Workers Builds Configuration: Edit, Zone: Read) and must be
 * user-scoped for the Workers Builds API.
 *
 * Usage
 * -----
 *   # PowerShell
 *   $env:CF_API_TOKEN = "<new token>"; node scripts/set-cf-token.mjs
 *
 *   # bash
 *   CF_API_TOKEN="<new token>" node scripts/set-cf-token.mjs
 *
 * Optional: set CF_ACCOUNT_ID to also (re)write the CF_ACCOUNT_ID secret.
 * The GitHub token is read from node_modules/.oauth-state.json (gitignored),
 * the same place oauth-login.mjs stores it; it is never printed.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildTokenTemplateUrl,
  openUrl,
  tokenChecklist,
  verifyCfToken,
  listCfAccounts,
  probeTokenCapabilities,
  TOKEN_TEMPLATES
} from './lib/cf-token-template.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATE_FILE = join(ROOT, 'node_modules', '.oauth-state.json')

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/**
 * Which token this run manages. They are different tokens with different
 * permissions and must not overwrite each other:
 *
 *   node scripts/set-cf-token.mjs            → ci      → GitHub secret CF_API_TOKEN
 *   node scripts/set-cf-token.mjs runtime    → runtime → GitHub secret CF_SITES_API_TOKEN
 *
 * The workflow installs CF_SITES_API_TOKEN on the Worker as CF_API_TOKEN, which
 * is what the CMS uses at runtime for domains, builds and build environments.
 */
const TEMPLATE_ID = (process.argv[2] || 'ci').trim()
if (!TOKEN_TEMPLATES[TEMPLATE_ID]) {
  fail(`未知的 token 模板 "${TEMPLATE_ID}"。可用：${Object.keys(TOKEN_TEMPLATES).join(', ')}`)
}
const SECRET_BY_TEMPLATE = { ci: 'CF_API_TOKEN', runtime: 'CF_SITES_API_TOKEN' }
const SECRET_NAME = SECRET_BY_TEMPLATE[TEMPLATE_ID] || 'CF_API_TOKEN'
const template = TOKEN_TEMPLATES[TEMPLATE_ID]

let token = (process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim()
const accountId = (process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()

// ---- 0) 没有 token 时，打开预填权限的 Cloudflare 页面，粘贴回来即可 ----
if (!token) {
  if (!process.stdin.isTTY) {
    const url = buildTokenTemplateUrl(TEMPLATE_ID, { accountId })
    fail(`未提供 token。用环境变量传入，或打开这个已预填权限的页面创建后重跑：\n  ${url}`)
  }

  const url = buildTokenTemplateUrl(TEMPLATE_ID, { accountId })

  console.log(`\n即将创建：${template.label}`)
  console.log(`用途：${template.purpose}\n`)
  console.log('页面会自动勾选这些权限（请在页面上核对）：')
  for (const line of tokenChecklist(TEMPLATE_ID)) console.log(`  · ${line}`)
  console.log('\n如果没有自动打开浏览器，请手动访问：')
  console.log(`  ${url}\n`)

  const opened = await openUrl(url)
  console.log(opened ? '已尝试打开浏览器。' : '⚠ 无法自动打开浏览器，请手动访问上面的链接。')
  console.log('在页面上点「继续以显示摘要」→「创建令牌」，然后复制生成的 token。\n')

  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await rl.question('粘贴 token（直接回车取消）: ')).trim()
  rl.close()

  if (!answer) fail('已取消，未做任何改动')
  token = answer
}

if (!existsSync(STATE_FILE)) {
  fail(
    '未找到 node_modules/.oauth-state.json，无法读取 GitHub 凭据（请先运行 node scripts/oauth-login.mjs）'
  )
}

const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
const gh = state.github
if (!gh?.token || !gh?.repo) {
  fail('.oauth-state.json 里缺少 GitHub token 或 repo')
}

// ---- 1) 先验证 Cloudflare 是否接受这个 token，避免写入一个坏值 ----
console.log('\n[1/3] 验证 Cloudflare token ...')
const verified = await verifyCfToken(token)
if (!verified.ok) {
  fail(
    `Cloudflare 拒绝了该 token (HTTP ${verified.httpStatus}): ` +
      JSON.stringify(verified.errors ?? {})
  )
}
console.log(`  ✓ token 有效，状态: ${verified.status ?? 'unknown'}`)

// ---- 2) 账号可见性（仅作提示）----
//
// A valid token that can deploy perfectly well may still be refused by
// GET /accounts, so this must not block writing the secret. It is only used to
// fill CF_ACCOUNT_ID when that is unambiguous.
console.log('[2/3] 检查账号可见性（仅提示）...')
const accountLookup = await listCfAccounts(token)
if (!accountLookup.ok) {
  console.log(
    `  ⚠ 无法列出账号（${JSON.stringify(accountLookup.errors)}）— 不影响写入 token。` +
      'CF_ACCOUNT_ID 请自行确认。'
  )
} else if (accountLookup.accounts.length === 0) {
  console.log('  ⚠ token 有效但看不到账号，请检查 token 的账号范围')
} else {
  console.log('  可见账号:')
  for (const a of accountLookup.accounts) console.log(`    - ${a.name}  ${a.id}`)
}

let resolvedAccountId = accountId
if (!resolvedAccountId && accountLookup.ok && accountLookup.accounts.length === 1) {
  resolvedAccountId = accountLookup.accounts[0].id
  console.log(`  (只有一个账号，将同时写入 CF_ACCOUNT_ID = ${resolvedAccountId})`)
}

// ---- 2.5) 实际探测权限（预填 URL 无法表达全部权限，尤其是 Pages）----
//
// Cloudflare 不为 "Workers CI" 与 "Pages" 公布 permission key，未知 key 会被页面
// 静默丢弃，所以从模板 URL 建出来的 token 仍可能缺 Pages 权限。这里直接拿 token 去
// 打这些 API，把"缺什么"在写入之前说清楚。
console.log('[2.5/3] 探测实际权限（打真实 API）...')
const capabilities = await probeTokenCapabilities(token, resolvedAccountId)
for (const cap of capabilities) {
  const mark = cap.ok === true ? '✓' : cap.ok === null ? '–' : '✗'
  console.log(`  ${mark} ${cap.label}`)
  if (cap.ok === false) {
    const detail = (cap.errors ?? []).map((e) => e.message || `code ${e.code}`).join('; ')
    console.log(`      HTTP ${cap.httpStatus}${detail ? `: ${detail}` : ''}`)
  }
}
const missing = capabilities.filter((cap) => cap.ok === false)
if (missing.length > 0) {
  console.log('\n⚠ 这个 token 缺少以下能力，相关功能会在 CI/后台里失败：')
  for (const cap of missing) console.log(`    · ${cap.permission}  →  ${cap.label}`)
  console.log('  修法：在 API 令牌页面编辑该 token，用 “Add more” 手动补上这些权限后保存')
  console.log('  （官方未公布这些 permission key，所以模板 URL 不会预填它们）。')
  console.log('  令牌值不变的话无需重新写入 secret。\n')
}

// ---- 3) 写入 GitHub secrets（libsodium sealed box，与 configure-secrets.mjs 同机制）----
console.log('[3/3] 写入 GitHub secrets ...')
const ghHeaders = {
  Authorization: `Bearer ${gh.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
}

const sodium = (await import('libsodium-wrappers')).default
await sodium.ready

const setSecret = async (name, value) => {
  const pubRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/public-key`, {
    headers: ghHeaders
  })
  if (!pubRes.ok) throw new Error(`public-key ${pubRes.status}`)
  const { key_id: keyId, key: pubKeyB64 } = await pubRes.json()

  const pubKey = sodium.from_base64(pubKeyB64, sodium.base64_variants.ORIGINAL)
  const encrypted = sodium.crypto_box_seal(new Uint8Array(Buffer.from(value)), pubKey)
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

  const putRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  })
  if (!putRes.ok && putRes.status !== 204 && putRes.status !== 201) {
    throw new Error(`set ${name} → HTTP ${putRes.status}`)
  }
}

const toWrite = { [SECRET_NAME]: token }
if (resolvedAccountId) toWrite.CF_ACCOUNT_ID = resolvedAccountId

for (const [name, value] of Object.entries(toWrite)) {
  try {
    await setSecret(name, value)
    console.log(`  ✓ ${name} 已更新`)
  } catch (error) {
    fail(`${name}: ${error.message}`)
  }
}

console.log('\n✅ 完成。只改动了:', Object.keys(toWrite).join(', '))
console.log('   未触碰 JWT_SECRET / D1 / KV / R2 / FLARE_API_URL / PAGES_PROJECT_NAME。')
console.log('\n下一步：')
if (TEMPLATE_ID === 'runtime') {
  console.log('   这个 token 由部署 workflow 装到 Worker 上（作为 CF_API_TOKEN），下次 push 生效；')
  console.log('   也可立刻在 Admin → Sites 底部表单粘贴使用（存进 D1 设置，无需重新部署）。')
} else {
  console.log('   push 到 main 会触发部署。')
}
console.log('   生产库 schema 由 CMS 运行时迁移（Worker 打包了全部 migrations，首个请求时应用），')
console.log('   不要用 wrangler d1 migrations apply --remote：那会引入第二套跟踪表。')
