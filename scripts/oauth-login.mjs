#!/usr/bin/env node
/**
 * 部署 OAuth 登录脚本
 *  1. GitHub 设备流（浏览器授权）→ 拿到 GitHub API token
 *  2. 检查仓库 secrets 缺口
 *  3. Cloudflare OAuth（PKCE + 本地回调 8976）→ 拿到 CF API token
 *  4. 两个 token 保存到临时文件供后续配置 secrets
 *
 * 用法: node scripts/oauth-login.mjs
 */

import { execSync } from 'node:child_process'
import http from 'node:http'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProxyAgent, setGlobalDispatcher } from 'undici'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATE_FILE = process.env.OAUTH_STATE_FILE || join(ROOT, 'node_modules', '.oauth-state.json')

// ---- 代理 ----
const getGitProxy = () => {
  try {
    return (
      execSync('git config --get http.proxy', { stdio: 'pipe', encoding: 'utf-8' }).trim() || null
    )
  } catch {
    return null
  }
}
const proxyUrl = getGitProxy()
if (proxyUrl) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl))
    console.log(`[proxy] ${proxyUrl}`)
  } catch {
    /* ignore */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const GH_CLIENT_ID = '178c6fc778ccc68e1d6a'
const GH_SCOPE = 'repo workflow'

const getRepo = () => {
  try {
    return execSync('git remote get-url origin', { stdio: 'pipe', encoding: 'utf-8' })
      .trim()
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/^git@github\.com:/, '')
      .replace(/\.git$/, '')
  } catch {
    return null
  }
}

// ===========================================================================
// 1. GitHub 设备流
// ===========================================================================

const githubDeviceLogin = async () => {
  const repo = getRepo()
  console.log(`\n[1/3] GitHub 设备流（仓库: ${repo}）`)

  const devRes = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: GH_CLIENT_ID, scope: GH_SCOPE })
  })
  if (!devRes.ok) throw new Error(`device/code ${devRes.status}`)
  const device = await devRes.json()
  const { device_code, user_code, verification_uri, interval, expires_in } = device

  console.log('\n┌──────────────────────────────────────────────┐')
  console.log('│  GitHub 授权需要您在浏览器操作：            │')
  console.log(`│  1) 打开: ${verification_uri}`)
  console.log(`│  2) 输入代码: ${user_code}`)
  console.log('└──────────────────────────────────────────────┘')
  console.log('（正在自动打开浏览器…）')
  try {
    execSync(
      process.platform === 'win32'
        ? `start ${verification_uri}`
        : process.platform === 'darwin'
          ? `open ${verification_uri}`
          : `xdg-open ${verification_uri}`,
      { stdio: 'ignore' }
    )
  } catch {
    /* ignore */
  }

  const pollInterval = Math.max(interval || 5, 5)
  const deadline = Date.now() + (expires_in || 900) * 1000
  console.log(
    `等待授权（轮询间隔 ${pollInterval}s，超时 ${Math.round((expires_in || 900) / 60)}min）...`
  )

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000)
    let res
    try {
      res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: GH_CLIENT_ID,
          device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })
    } catch {
      continue
    }
    if (!res.ok) continue
    const data = await res.json()
    if (data.access_token) {
      // 验证 token
      const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      })
      if (userRes.ok) {
        const user = await userRes.json()
        console.log(`✓ GitHub 授权成功 — ${user.login}`)
        return { token: data.access_token, repo, login: user.login }
      }
    } else if (data.error === 'slow_down') {
      await sleep(5000)
    } else if (data.error === 'expired_token' || data.error === 'access_denied') {
      throw new Error(`GitHub 授权失败: ${data.error_description || data.error}`)
    }
  }
  throw new Error('GitHub 授权超时')
}

// ===========================================================================
// 2. 检查 secrets 缺口
// ===========================================================================

const REQUIRED_SECRETS = [
  'CF_API_TOKEN',
  'CF_ACCOUNT_ID',
  'CF_D1_DATABASE_ID',
  'CF_R2_BUCKET_NAME',
  'CF_KV_NAMESPACE_ID',
  'JWT_SECRET',
  'SCIFI_API_URL'
]

const listSecrets = async (gh) => {
  const res = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets`, {
    headers: {
      Authorization: `Bearer ${gh.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) throw new Error(`list secrets ${res.status}`)
  const d = await res.json()
  return (d.secrets || []).map((s) => s.name)
}

const githubSetSecret = async (gh, name, value) => {
  const headers = {
    Authorization: `Bearer ${gh.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  const pubRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/public-key`, {
    headers
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
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  })
  if (!putRes.ok && putRes.status !== 204) throw new Error(`set ${name} ${putRes.status}`)
  return true
}

// ===========================================================================
// 3. Cloudflare OAuth（PKCE + 本地回调）
// ===========================================================================

const CF_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const CF_AUTH_URL = 'https://dash.cloudflare.com/oauth2/auth'
const CF_TOKEN_URL = 'https://dash.cloudflare.com/oauth2/token'
const CF_CALLBACK = 'http://localhost:8976/oauth/callback'
const CF_SCOPES = [
  'account:read',
  'user:read',
  'workers:write',
  'workers_kv:write',
  'workers_routes:write',
  'workers_scripts:write',
  'workers_tail:read',
  'd1:write',
  'pages:write',
  'zone:read'
]

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const cloudflareOAuth = async () => {
  console.log('\n[2/3] Cloudflare OAuth（PKCE）')
  const codeVerifier = b64url(globalThis.crypto.getRandomValues(new Uint8Array(32)))
  const codeChallenge = b64url(
    new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', Buffer.from(codeVerifier)))
  )
  const state = b64url(globalThis.crypto.getRandomValues(new Uint8Array(16)))

  const authUrl = `${CF_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(
    CF_CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(CF_CALLBACK)}&scope=${encodeURIComponent(
    [...CF_SCOPES, 'offline_access'].join(' ')
  )}&state=${state}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`

  console.log('\n┌──────────────────────────────────────────────┐')
  console.log('│  Cloudflare 授权需要您在浏览器操作：        │')
  console.log('│  登录 dash.cloudflare.com 并允许 Wrangler 权限 │')
  console.log('└──────────────────────────────────────────────┘')
  console.log('（正在自动打开浏览器… 若未打开请手动访问:')
  console.log(`  ${authUrl}`)

  try {
    // Windows cmd 的 start 会把 & 当分隔符，必须用引号包裹整个 URL，且用 cmd /c start "" "url"
    const openCmd =
      process.platform === 'win32'
        ? `cmd /c start "" "${authUrl}"`
        : process.platform === 'darwin'
          ? `open "${authUrl}"`
          : `xdg-open "${authUrl}"`
    execSync(openCmd, { stdio: 'ignore' })
  } catch {
    /* ignore */
  }

  // 本地回调服务器
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404)
        res.end('Not Found')
        return
      }
      const cbState = url.searchParams.get('state')
      const cbCode = url.searchParams.get('code')
      if (cbState !== state) {
        res.writeHead(400)
        res.end('State mismatch')
        reject(new Error('OAuth state 不匹配'))
        server.close()
        return
      }
      // 设置 charset + 内联 meta 确保浏览器按 UTF-8 解码（避免中文乱码）
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<meta charset="utf-8"><h3>Cloudflare 授权成功 ✅ 可以回到终端继续</h3>')
      server.close()
      if (cbCode) resolve(cbCode)
      else reject(new Error('回调缺少 code'))
    })
    server.listen(8976, '127.0.0.1')
    // 120 秒超时
    setTimeout(() => {
      server.close()
      reject(new Error('Cloudflare 授权超时（120 秒）'))
    }, 120000)
  })

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: CF_CALLBACK,
    client_id: CF_CLIENT_ID,
    code_verifier: codeVerifier
  })
  const res = await fetch(CF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  })
  if (!res.ok) throw new Error(`CF token 交换失败 ${res.status}`)
  const data = await res.json()
  console.log('✓ Cloudflare OAuth 授权成功')
  return {
    token: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || 3600
  }
}

// ===========================================================================
// 主流程
// ===========================================================================

const main = async () => {
  const state = {}

  // 1. GitHub
  const gh = await githubDeviceLogin()
  state.github = gh
  // 立即保存 GitHub 状态（Cloudflare 失败也不丢）
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  console.log(`GitHub 状态已保存`)

  // 2. 检查 secrets 缺口
  const existing = await listSecrets(gh)
  const missing = REQUIRED_SECRETS.filter((s) => !existing.includes(s))
  console.log(`\n[secrets] 已有 ${existing.length} 个，缺失 ${missing.length} 个:`)
  for (const m of missing) console.log(`  - ${m}`)
  state.missingSecrets = missing
  state.existingSecrets = existing

  // 3. Cloudflare OAuth
  const cf = await cloudflareOAuth()
  state.cloudflare = {
    token: cf.token,
    refreshToken: cf.refreshToken,
    expiresIn: cf.expiresIn,
    expiresAt: Date.now() + cf.expiresIn * 1000
  }
  // 最终保存（含 CF token）
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  console.log(`\n✅ OAuth 完成，状态已保存: ${STATE_FILE}`)
  console.log(
    '下一步: node scripts/configure-secrets.mjs 将 CF 资源配置写入 GitHub secrets 并触发部署'
  )
}

main().catch((e) => {
  console.error(`✗ ${e.message}`)
  process.exit(1)
})
