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

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATE_FILE = join(ROOT, 'node_modules', '.oauth-state.json')

const token = (process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '').trim()
const accountId = (process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!token) {
  fail('未提供 token。请设置 CF_API_TOKEN 环境变量（见本文件顶部 usage）')
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
console.log('[1/3] 验证 Cloudflare token ...')
const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
  headers: { Authorization: `Bearer ${token}` }
})
const verifyJson = await verifyRes.json().catch(() => ({}))
if (!verifyRes.ok || verifyJson.success !== true) {
  fail(
    `Cloudflare 拒绝了该 token (HTTP ${verifyRes.status}): ` +
      JSON.stringify(verifyJson.errors ?? verifyJson.messages ?? verifyJson)
  )
}
console.log(`  ✓ token 有效，状态: ${verifyJson.result?.status ?? 'unknown'}`)

// ---- 2) 确认它至少能看到账号（deploy 需要）----
console.log('[2/3] 检查账号可见性 ...')
const accountsRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
  headers: { Authorization: `Bearer ${token}` }
})
const accountsJson = await accountsRes.json().catch(() => ({}))
if (!accountsRes.ok || accountsJson.success !== true) {
  fail(
    `无法列出账号 (HTTP ${accountsRes.status}) — CI token 需要至少一个 account 级权限: ` +
      JSON.stringify(accountsJson.errors ?? {})
  )
}
const accounts = accountsJson.result ?? []
if (accounts.length === 0) {
  fail('token 有效但看不到任何账号，请检查 token 的账号范围')
}
console.log('  可见账号:')
for (const a of accounts) console.log(`    - ${a.name}  ${a.id}`)

let resolvedAccountId = accountId
if (!resolvedAccountId && accounts.length === 1) {
  resolvedAccountId = accounts[0].id
  console.log(`  (只有一个账号，将同时写入 CF_ACCOUNT_ID = ${resolvedAccountId})`)
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

const toWrite = { CF_API_TOKEN: token }
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
console.log('\n下一步建议先本地验证迁移能打到远端:')
console.log(
  '   cd cms/packages/cms && npx wrangler d1 migrations apply DB --env production --remote'
)
