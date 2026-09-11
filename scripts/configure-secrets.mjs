#!/usr/bin/env node
/**
 * 写入 GitHub Actions secrets 并触发部署
 *
 * 从 OAuth 状态文件 + 环境变量读取 Cloudflare 凭据与资源 ID，
 * 写入 GitHub secrets，然后 push 触发 deploy workflow。
 *
 * 用法: node scripts/configure-secrets.mjs
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProxyAgent, setGlobalDispatcher } from 'undici'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATE_FILE = join(ROOT, 'node_modules', '.oauth-state.json')
const CMS_PKG = join(ROOT, 'cms', 'packages', 'cms')

// ---- 代理（GitHub 走代理，Cloudflare 直连）----
try {
  const p = execSync('git config --get http.proxy', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  if (p) {
    setGlobalDispatcher(new ProxyAgent(p))
    console.log(`[proxy] ${p}`)
  }
} catch {
  /* ignore */
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 读取 OAuth 状态 ----
if (!existsSync(STATE_FILE)) {
  console.error('✗ 未找到 .oauth-state.json，请先运行 node scripts/oauth-login.mjs')
  process.exit(1)
}
const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
const gh = state.github
const cf = state.cloudflare

if (!gh?.token) {
  console.error('✗ 缺少 GitHub token，请重新运行 oauth-login.mjs')
  process.exit(1)
}

console.log(`✓ GitHub: ${gh.login} @ ${gh.repo}`)
if (cf?.token) console.log('✓ Cloudflare OAuth token 可用')
else console.log('⚠ 无 CF OAuth token — 用 CLOUDFLARE_API_TOKEN 环境变量替代')

// ---- CF token 来源：OAuth 或环境变量 ----
const cfToken = cf?.token || process.env.CLOUDFLARE_API_TOKEN
if (!cfToken) {
  console.error('✗ 无 Cloudflare token（请提供环境变量 CLOUDFLARE_API_TOKEN 或重新 OAuth）')
  process.exit(1)
}

// ---- wrangler 辅助（直接跑命令，token 走环境变量）----
const wranglerBin = join(
  CMS_PKG,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
)

const runWrangler = (args) => {
  try {
    return execSync(`"${wranglerBin}" ${args}`, {
      cwd: CMS_PKG,
      stdio: 'pipe',
      encoding: 'utf-8',
      env: {
        ...process.env,
        // 确保 wrangler 能找到 node（Windows 上 PATH 用分号分隔）
        PATH: `D:/programe/nodejs;${CMS_PKG}/node_modules/.bin;${ROOT}/node_modules/.bin;${process.env.PATH || ''}`,
        CLOUDFLARE_API_TOKEN: cfToken
      }
    })
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`
  }
}

const extractId = (out, pattern) => {
  const m = out.match(pattern)
  return m ? m[1] : null
}

// ---- 获取账号信息 ----
console.log('\n[1/4] Cloudflare 账号...')
let accountId = process.env.CLOUDFLARE_ACCOUNT_ID
let whoamiOut = ''
if (!accountId) {
  whoamiOut = runWrangler('whoami')
  // 表格输出形如: | Account Name | Account ID | 行里包含 32 位 hex
  const m = whoamiOut.match(/([0-9a-f]{32})/)
  accountId = m ? m[1] : null
}
if (!accountId) {
  console.error('✗ 无法获取账号 ID')
  console.error(whoamiOut || '')
  process.exit(1)
}
console.log(`✓ account_id: ${accountId}`)

// ---- 资源 ID（已创建的用已创建的；可环境变量覆盖）----
console.log('\n[2/4] 资源确认...')
const d1Id = process.env.CF_D1_DATABASE_ID || '9096c6ab-bb18-4f94-b836-c2673d3c8b19' // 已创建
const kvId = process.env.CF_KV_NAMESPACE_ID || '50ff25b411a149cfbfdfeb615cd0acbd' // 已创建
const r2Name = process.env.CF_R2_BUCKET_NAME || 'arwes-cms-media'
const flareUrl = process.env.FLARE_API_URL || 'https://flare-cms.arwes.workers.dev'
const pagesName = process.env.PAGES_PROJECT_NAME || 'arwes-docs'

console.log(`  D1: ${d1Id}`)
console.log(`  KV: ${kvId}`)
console.log(`  R2: ${r2Name}`)
console.log(`  FLARE_URL: ${flareUrl}`)
console.log(`  PAGES: ${pagesName}`)

// ---- 写入 secrets ----
console.log('\n[3/4] 写入 GitHub secrets...')

const ghHeaders = {
  Authorization: `Bearer ${gh.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
}

const githubSetSecret = async (name, value) => {
  if (!value) return false
  const pubRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/public-key`, {
    headers: ghHeaders
  })
  if (!pubRes.ok) throw new Error(`public-key ${pubRes.status}`)
  const { key_id: keyId, key: pubKeyB64 } = await pubRes.json()

  const sodium = (await import('libsodium-wrappers')).default
  await sodium.ready
  const pubKey = sodium.from_base64(pubKeyB64, sodium.base64_variants.ORIGINAL)
  const encrypted = sodium.crypto_box_seal(new Uint8Array(Buffer.from(value)), pubKey)
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

  const putRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  })
  if (!putRes.ok && putRes.status !== 204) throw new Error(`set ${name} ${putRes.status}`)
  return true
}

const jwtSecret = `arwes-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const secrets = {
  CF_API_TOKEN: cfToken,
  CF_ACCOUNT_ID: accountId,
  CF_D1_DATABASE_ID: d1Id,
  CF_R2_BUCKET_NAME: r2Name,
  CF_KV_NAMESPACE_ID: kvId,
  JWT_SECRET: jwtSecret,
  FLARE_API_URL: flareUrl,
  PAGES_PROJECT_NAME: pagesName
}

let ok = 0
let fail = 0
for (const [name, value] of Object.entries(secrets)) {
  try {
    await githubSetSecret(name, value)
    console.log(`  ✓ ${name}`)
    ok++
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`)
    fail++
  }
}
console.log(`\nsecrets 写入: ${ok} 成功, ${fail} 失败`)

// ---- 展示现有 secrets ----
const listRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets`, {
  headers: ghHeaders
})
if (listRes.ok) {
  const d = await listRes.json()
  console.log(`\n当前仓库 secrets (${(d.secrets || []).length}):`)
  for (const s of d.secrets || []) console.log(`  - ${s.name}`)
}

if (fail > 0) process.exit(1)
console.log('\n✅ secrets 就绪，可以触发部署')
