#!/usr/bin/env node
/**
 * ARWES + Flare CMS 初始化控制台 (OpenTUI)
 *
 * 以 GitHub 为唯一入口登录，之后进入主界面，像一个完整 TUI 应用：
 *
 *   ╭────────────────────────────────────────────╮
 *   │  ARWES × Flare CMS 控制台                   │
 *   │  主菜单：                                    │
 *   │    ● Cloudflare 状态                        │
 *   │      GitHub Actions 状态                    │
 *   │      Backblaze B2 存储                      │
 *   │      Secrets 管理                            │
 *   │      退出                                    │
 *   ╰────────────────────────────────────────────╯
 *
 * 主界面可随时查看/管理：
 *   - Cloudflare 登录状态、D1/R2/KV 资源、连接配置
 *   - GitHub Actions workflows 与最近运行
 *   - Backblaze B2 连接状态与配置
 *   - GitHub secrets 列表与增删
 *
 * 用法: node --experimental-ffi scripts/setup-tui-opentui.mjs
 *       npm run setup
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProxyAgent, setGlobalDispatcher } from 'undici'

import {
  buildTokenTemplateUrl,
  openUrl,
  tokenChecklist,
  verifyCfToken
} from './lib/cf-token-template.mjs'

import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderableEvents,
  createCliRenderer
} from '@opentui/core'

// ===========================================================================
// 代理初始化：自动读取 git 代理配置，让 fetch 能访问 GitHub 等
// ===========================================================================

const getGitProxy = () => {
  try {
    const out = execSync('git config --get http.proxy', {
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim()
    return out || null
  } catch {
    return null
  }
}

const proxyUrl = getGitProxy()
if (proxyUrl) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl))
    console.error(`[proxy] 使用 git 代理: ${proxyUrl}`)
  } catch {
    // 代理不可用则直连
  }
} else if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  try {
    const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    setGlobalDispatcher(new ProxyAgent(envProxy))
    console.error(`[proxy] 使用环境代理: ${envProxy}`)
  } catch {
    // 忽略
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CMS_PKG = join(ROOT, 'cms', 'packages', 'cms')
const DEV_VARS = join(CMS_PKG, '.dev.vars')
const DOCS_DIR = join(ROOT, 'apps', 'docs')

// ===========================================================================
// 渲染器与根节点
// ===========================================================================

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  useKittyKeyboard: { events: true, alternateKeys: true, disambiguate: false }
})
const root = renderer.root

let uiDestroyed = false
const destroyUi = () => {
  if (!uiDestroyed) {
    uiDestroyed = true
    renderer.destroy()
  }
}

const onCtrlC = (key) => {
  if (key.ctrl && key.name === 'c') {
    destroyUi()
    process.exit(0)
  }
}
renderer.keyInput.on('keypress', onCtrlC)

// ===========================================================================
// 基础 UI 组件
// ===========================================================================

const makeBox = (opts = {}) =>
  new BoxRenderable(renderer, {
    border: true,
    shouldFill: true,
    paddingX: 1,
    ...opts
  })

const makeText = (content, opts = {}) => new TextRenderable(renderer, { content, ...opts })

const makeSelect = (options, opts = {}) =>
  new SelectRenderable(renderer, {
    options,
    height: Math.min(options.length + 1, 14),
    ...opts
  })

// 全屏布局：顶部标题、中部内容、底部状态
const mainBox = makeBox({
  title: '🚀 ARWES + Flare CMS 控制台',
  flexDirection: 'column',
  titleColor: '#00ffcc'
})
root.add(mainBox)

const titleBar = makeText('', { height: 1 })
const contentBox = makeBox({
  flexGrow: 1,
  flexDirection: 'column',
  border: false,
  shouldFill: false,
  minHeight: 5
})
const statusBar = makeText('', { height: 1 })
mainBox.add(titleBar)
mainBox.add(contentBox)
mainBox.add(statusBar)

const setTitle = (text) => {
  titleBar.content = text
}
const setStatus = (text) => {
  statusBar.content = text
}

const clearContent = () => {
  for (const child of contentBox.getChildren()) {
    contentBox.remove(child)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ===========================================================================
// 交互辅助：选择 / 输入（支持 Esc 返回主菜单）
// ===========================================================================

const BACK = Symbol('back')

// 弹出一个选择列表。返回所选 option 的 value；用户按 Esc 返回 BACK。
const askSelect = (prompt, options) =>
  new Promise((resolve) => {
    clearContent()
    const promptText = makeText(` ${prompt}`, { height: 1 })
    const select = makeSelect(options)
    contentBox.add(promptText)
    contentBox.add(select)

    setStatus('↑↓ 选择，Enter 确认，Esc 返回，Ctrl+C 退出')
    select.focus()

    const onKey = (key) => {
      if (key.name === 'escape') {
        renderer.keyInput.off('keypress', onKey)
        select.off(SelectRenderableEvents.ITEM_SELECTED, onSelect)
        resolve(BACK)
      }
    }
    // ITEM_SELECTED 事件载荷为 (index, option)
    const onSelect = (_index, option) => {
      renderer.keyInput.off('keypress', onKey)
      select.off(SelectRenderableEvents.ITEM_SELECTED, onSelect)
      resolve(option.value)
    }
    select.on(SelectRenderableEvents.ITEM_SELECTED, onSelect)
    renderer.keyInput.on('keypress', onKey)
  })

// 弹出单行输入。返回输入值；用户按 Esc 返回 BACK。
const askInput = (prompt, options = {}) =>
  new Promise((resolve) => {
    clearContent()
    const promptText = makeText(` ${prompt}`, { height: 1 })
    const input = new InputRenderable(renderer, {
      value: options.value ?? '',
      placeholder: options.placeholder ?? '',
      width: Math.min(renderer.terminalWidth - 6, 70)
    })
    contentBox.add(promptText)
    contentBox.add(input)

    setStatus(options.hint ?? '输入内容，Enter 确认，Esc 返回，Ctrl+C 退出')
    input.focus()

    const onKey = (key) => {
      if (key.name === 'escape') {
        renderer.keyInput.off('keypress', onKey)
        input.off(InputRenderableEvents.ENTER, onEnter)
        resolve(BACK)
      }
    }
    const onEnter = (value) => {
      renderer.keyInput.off('keypress', onKey)
      input.off(InputRenderableEvents.ENTER, onEnter)
      resolve(value)
    }
    input.on(InputRenderableEvents.ENTER, onEnter)
    renderer.keyInput.on('keypress', onKey)
  })

// 确认提示
const askConfirm = (prompt) =>
  askSelect(prompt, [
    { name: 'Yes', value: true },
    { name: 'No', value: false }
  ])

// 简单的状态面板：显示多行文本，等待 Enter 返回
const showPanel = async (title, lines, hint = 'Enter 返回') =>
  new Promise((resolve) => {
    clearContent()
    const box = makeBox({ title, flexDirection: 'column' })
    for (const line of lines) {
      box.add(makeText(` ${line}`))
    }
    contentBox.add(box)
    setStatus(hint + '，Esc 返回主菜单，Ctrl+C 退出')
  })

// ===========================================================================
// GitHub Secrets 管理器
// ===========================================================================

let ghSession = null // { token, repo, login }

const githubSetSecret = async (token, repo, name, value) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  const pubRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, {
    headers
  })
  if (!pubRes.ok) {
    throw new Error(`获取公钥失败 (${pubRes.status})`)
  }
  const { key_id: keyId, key: pubKeyB64 } = await pubRes.json()

  const sodium = (await import('libsodium-wrappers')).default
  await sodium.ready
  const pubKey = sodium.from_base64(pubKeyB64, sodium.base64_variants.ORIGINAL)
  const encrypted = sodium.crypto_box_seal(new Uint8Array(Buffer.from(value)), pubKey)
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

  const putRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  })
  if (!putRes.ok && putRes.status !== 204) {
    throw new Error(`设置 secret ${name} 失败 (${putRes.status})`)
  }
  return true
}

const githubListSecrets = async (s) => {
  const res = await fetch(`https://api.github.com/repos/${s.repo}/actions/secrets`, {
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.secrets || []).map((x) => x.name)
}

const saveSecret = async (name, value) => {
  if (!ghSession) return false
  if (!value) return false
  try {
    await githubSetSecret(ghSession.token, ghSession.repo, name, value)
    return true
  } catch (err) {
    setStatus(`✗ ${name} 保存失败: ${err.message.slice(0, 60)}`)
    await sleep(900)
    return false
  }
}

// ===========================================================================
// GitHub 登录（唯一的入口）
// ===========================================================================

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

const githubDeviceAuth = async () => {
  const repo = getRepo()
  if (!repo) {
    return { error: '未找到 GitHub 远程仓库（git remote get-url origin）' }
  }

  const GH_CLIENT_ID = '178c6fc778ccc68e1d6a'

  setStatus('请求 GitHub 设备授权...')
  let deviceRes
  try {
    deviceRes = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: GH_CLIENT_ID, scope: 'repo workflow' })
    })
  } catch (err) {
    return { error: `无法连接 GitHub: ${err.message.slice(0, 80)}` }
  }
  if (!deviceRes.ok) {
    return { error: `设备授权请求失败 (${deviceRes.status})` }
  }
  const deviceData = await deviceRes.json()
  const { device_code, user_code, verification_uri } = deviceData

  clearContent()
  const infoBox = makeBox({ title: 'GitHub 授权', flexDirection: 'column' })
  infoBox.add(makeText(` 1. 在浏览器打开:  ${verification_uri}`))
  infoBox.add(makeText(` 2. 输入代码:  ${user_code}`))
  infoBox.add(makeText('（如未自动打开浏览器，请手动访问上述链接）'))
  contentBox.add(infoBox)

  try {
    const openCmd =
      process.platform === 'win32'
        ? `start ${verification_uri}`
        : process.platform === 'darwin'
          ? `open ${verification_uri}`
          : `xdg-open ${verification_uri}`
    execSync(openCmd, { stdio: 'ignore' })
  } catch {
    // 忽略
  }

  setStatus(`等待浏览器授权完成…（仓库: ${repo}，Ctrl+C 取消）`)

  const pollInterval = Math.max(deviceData.interval || 5, 5)
  const deadline = Date.now() + (deviceData.expires_in || 900) * 1000
  let token = null

  while (Date.now() < deadline && !token) {
    await sleep(pollInterval * 1000)
    let tokenRes
    try {
      tokenRes = await fetch('https://github.com/login/oauth/access_token', {
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
    if (!tokenRes.ok) break
    const tokenData = await tokenRes.json()
    if (tokenData.access_token) {
      token = tokenData.access_token
    } else if (tokenData.error === 'slow_down') {
      await sleep(5000)
    } else if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
      break
    }
  }

  if (!token) {
    return { error: '授权超时或未完成' }
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!userRes.ok) {
    return { error: `授权 token 无效 (${userRes.status})` }
  }
  const user = await userRes.json()

  ghSession = { token, repo, login: user.login }
  return { ok: true }
}

// ===========================================================================
// 各服务状态查询
// ===========================================================================

// --- Cloudflare ---

const runWrangler = (args, opts = {}) => {
  const wranglerBin = join(
    CMS_PKG,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  )
  // 优先使用内存中的 CF API Token 驱动（不依赖本机 OAuth 登录）
  const env = {
    ...process.env,
    ...(cfToken ? { CLOUDFLARE_API_TOKEN: cfToken } : {}),
    ...(cfAccountId ? { CLOUDFLARE_ACCOUNT_ID: cfAccountId } : {}),
    ...(opts.env || {})
  }
  try {
    return execSync(`"${wranglerBin}" ${args}`, {
      cwd: CMS_PKG,
      stdio: 'pipe',
      encoding: 'utf-8',
      ...opts,
      env
    })
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`
  }
}

// 内存中的 Cloudflare 凭据（从 TUI 输入获取，不落盘）
let cfToken = null
let cfAccountId = null

// Cloudflare OAuth —— 复用 wrangler 的 OAuth client（授权码 + PKCE + 本地回调）
// 与 wrangler login 完全一致的流程，但直接在 TUI 内完成并拿到 token
const CF_OAUTH_CLIENT_ID = '54d11594-84e4-41aa-b438-e81b8fa78ee7'
const CF_OAUTH_AUTH_URL = 'https://dash.cloudflare.com/oauth2/auth'
const CF_OAUTH_TOKEN_URL = 'https://dash.cloudflare.com/oauth2/token'
const CF_OAUTH_CALLBACK = 'http://localhost:8976/oauth/callback'
const CF_OAUTH_SCOPES = [
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

// PKCE 工具
const base64urlEncode = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const cloudflareOAuth = async () => {
  // 1. 生成 PKCE code_verifier / code_challenge
  const codeVerifier = base64urlEncode(globalThis.crypto.getRandomValues(new Uint8Array(32)))
  const codeChallenge = base64urlEncode(
    new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', Buffer.from(codeVerifier)))
  )

  // 2. 生成本地回调 token（随机 state）
  const state = base64urlEncode(globalThis.crypto.getRandomValues(new Uint8Array(16)))

  // 3. 组装授权 URL
  const authUrl = `${CF_OAUTH_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(
    CF_OAUTH_CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(
    CF_OAUTH_CALLBACK
  )}&scope=${encodeURIComponent([...CF_OAUTH_SCOPES, 'offline_access'].join(' '))}&state=${state}&code_challenge=${encodeURIComponent(
    codeChallenge
  )}&code_challenge_method=S256`

  // 4. 展示授权信息 + 浏览器打开
  clearContent()
  const infoBox = makeBox({ title: 'Cloudflare OAuth 授权', flexDirection: 'column' })
  infoBox.add(makeText(` 浏览器将打开 Cloudflare 登录页，请完成授权（登录并允许 Wrangler 权限）`))
  infoBox.add(makeText(` 如果没有自动打开，请手动访问:`))
  infoBox.add(makeText(` ${authUrl}`))
  contentBox.add(infoBox)

  try {
    const openCmd =
      process.platform === 'win32'
        ? `start ${authUrl}`
        : process.platform === 'darwin'
          ? `open ${authUrl}`
          : `xdg-open ${authUrl}`
    execSync(openCmd, { stdio: 'ignore' })
  } catch {
    // 忽略
  }

  setStatus('等待 Cloudflare 授权完成…（Ctrl+C 取消）')

  // 5. 本地回调服务器（等待浏览器重定向带 code）
  const http = await import('node:http')
  const codePromise = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404)
        res.end('Not Found')
        return
      }
      const { code, state: cbState } = Object.fromEntries(url.searchParams)
      if (cbState !== state) {
        res.writeHead(400)
        res.end('State mismatch')
        reject(new Error('OAuth state 不匹配'))
        server.close()
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h3>Cloudflare 授权成功 ✅ 可以回到终端继续</h3>')
      server.close()
      if (code) resolve(code)
      else reject(new Error('授权回调中缺少 code'))
    })
    server.listen(8976, '127.0.0.1', () => {
      // 等待回调
    })
    // 60 秒超时
    setTimeout(() => {
      server.close()
      reject(new Error('授权超时（60 秒）'))
    }, 60000)
  })

  let code
  try {
    code = await codePromise
  } catch (err) {
    setStatus(`✗ OAuth 失败: ${err.message}`)
    await sleep(1200)
    return null
  }

  // 6. 用 code 换取 access_token
  try {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CF_OAUTH_CALLBACK,
      client_id: CF_OAUTH_CLIENT_ID,
      code_verifier: codeVerifier
    })
    const res = await fetch(CF_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    })
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 200)
      setStatus(`✗ 换取 token 失败 (${res.status}): ${errText}`)
      await sleep(1500)
      return null
    }
    const data = await res.json()
    const { access_token, refresh_token, expires_in } = data
    if (!access_token) {
      setStatus('✗ 响应中无 access_token')
      await sleep(1200)
      return null
    }
    cfToken = access_token
    // 保存 refresh_token 以便后续刷新（存内存，不落盘）
    globalThis.__cfRefreshToken = refresh_token || null
    globalThis.__cfTokenExpires = Date.now() + (expires_in || 3600) * 1000

    setStatus('✓ Cloudflare OAuth 授权成功')
    await sleep(800)
    return { token: cfToken }
  } catch (err) {
    setStatus(`✗ 换取 token 出错: ${err.message}`)
    await sleep(1200)
    return null
  }
}

const isWranglerLoggedIn = () => {
  // 有 API Token 或本机 OAuth 登录都算可用
  if (cfToken) return true
  const out = runWrangler('whoami')
  return !out.includes('Not logged in') && !out.includes('Failed to fetch auth token')
}

const extractId = (out, pattern) => {
  const m = out.match(pattern)
  return m ? m[1] : null
}

// --- GitHub Actions ---

const githubListWorkflows = async (s) => {
  const res = await fetch(`https://api.github.com/repos/${s.repo}/actions/workflows`, {
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.workflows || []).map((w) => ({
    name: w.name,
    path: w.path,
    state: w.state,
    runCount: w.run_count || 0
  }))
}

const githubRecentRuns = async (s, limit = 8) => {
  const res = await fetch(`https://api.github.com/repos/${s.repo}/actions/runs?per_page=${limit}`, {
    headers: {
      Authorization: `Bearer ${s.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.workflow_runs || []).map((r) => ({
    name: r.name,
    conclusion: r.conclusion || r.status,
    createdAt: r.created_at
  }))
}

// ===========================================================================
// Cloudflare 面板
// ===========================================================================

const panelCloudflare = async () => {
  setTitle('🌐 Cloudflare 控制台')

  for (;;) {
    const loggedIn = isWranglerLoggedIn()
    clearContent()
    const box = makeBox({ title: 'Cloudflare 状态', flexDirection: 'column' })
    box.add(makeText(` 登录: ${loggedIn ? '✓ 已登录' : '✗ 未登录'}`))
    box.add(makeText(' D1 / R2 / KV: 使用 wrangler 管理（见下方菜单操作）'))
    contentBox.add(box)

    const action = await askSelect('Cloudflare 操作:', [
      { name: `登录 Cloudflare（${loggedIn ? '已登录' : '未登录'}）`, value: 'login' },
      { name: '创建 D1 数据库', value: 'd1' },
      { name: '创建 R2 桶', value: 'r2' },
      { name: '创建 KV namespace', value: 'kv' },
      { name: '配置账号 secrets（CF_ACCOUNT_ID / FLARE_API_URL 等）', value: 'secrets' },
      { name: '返回主菜单', value: 'exit' }
    ])
    if (action === BACK) return
    if (action === 'exit') return

    if (action === 'login') {
      if (loggedIn) {
        setStatus('✓ 已登录 Cloudflare')
        await sleep(500)
        continue
      }
      const choice = await askSelect('登录方式:', [
        {
          name: '打开 Cloudflare 页面生成 API Token（推荐）',
          description: '自动预填权限，页面里点两下即可；生成的是长期 token，适合写入 CF_API_TOKEN',
          value: 'token'
        },
        {
          name: 'Cloudflare OAuth（浏览器授权，TUI 内完成）',
          description:
            '仅本次会话用于 wrangler 操作；OAuth token 只有 1 小时寿命，不会写入 CF_API_TOKEN',
          value: 'oauth'
        },
        { name: '取消', value: 'cancel' }
      ])
      if (choice === BACK || choice === 'cancel') continue
      if (choice === 'oauth') {
        const oauth = await cloudflareOAuth()
        if (oauth?.token) {
          // Used in memory for the wrangler calls this TUI makes. Deliberately
          // NOT persisted: an OAuth access token expires after an hour, and
          // storing one in CF_API_TOKEN is what made the deploy workflow fail
          // roughly hourly. Use the template flow for that secret.
          cfToken = oauth.token
          setStatus(
            '✓ OAuth token 已就绪（仅本次会话）。如需写入 CF_API_TOKEN 请选「生成 API Token」'
          )
          await sleep(1200)
        }
        continue
      }
      if (choice === 'token') {
        const url = buildTokenTemplateUrl('ci', { accountId: cfAccountId || undefined })

        clearContent()
        const info = makeBox({ title: '生成 Cloudflare API Token', flexDirection: 'column' })
        info.add(makeText(' 页面会自动勾选这些权限，请在页面上核对：'))
        for (const line of tokenChecklist('ci')) info.add(makeText(`   · ${line}`))
        info.add(makeText(' '))
        info.add(makeText(' 在页面上点「继续以显示摘要」→「创建令牌」，然后复制生成的 token。'))
        info.add(makeText(' 如果没有自动打开浏览器，请手动访问：'))
        info.add(makeText(` ${url}`))
        contentBox.add(info)

        const opened = await openUrl(url)
        setStatus(
          opened
            ? '已打开浏览器，复制 token 后按 Enter 继续…'
            : '⚠ 无法自动打开浏览器，请手动访问上方链接，然后按 Enter 继续…'
        )
        await askInput('（按 Enter 继续）', { hint: 'Enter 继续，Esc 返回' })

        const token = await askInput('粘贴 Cloudflare API Token:', {
          hint: 'Enter 确认后会先校验，校验通过才写入 secrets'
        })
        if (token === BACK) continue
        const value = token.trim()
        if (!value) continue

        setStatus('校验 token...')
        const verified = await verifyCfToken(value)
        if (!verified.ok) {
          setStatus(
            `✗ Cloudflare 拒绝了该 token：${JSON.stringify(verified.errors)}（未写入任何 secret）`
          )
          await sleep(2000)
          continue
        }
        setStatus(`✓ token 有效（${verified.status ?? 'unknown'}），正在保存 CF_API_TOKEN...`)
        cfToken = value // 存入内存供 wrangler 使用
        const ok = await saveSecret('CF_API_TOKEN', value)
        setStatus(ok ? '✓ CF_API_TOKEN 已保存（长期 token）' : '✗ 保存失败')
        await sleep(900)
      }
      continue
    }

    if (action === 'd1') {
      const name = await askInput('D1 数据库名称:', { value: 'arwes-cms-db' })
      if (name === BACK) continue
      setStatus(`创建 D1 ${name}...`)
      await sleep(300)
      let id = null
      try {
        const out = runWrangler(`d1 create ${name}`)
        id = extractId(out, /database_id\s*=\s*"([^"]+)"/) || extractId(out, /(\b[0-9a-f]{32}\b)/)
      } catch {
        id = null
      }
      if (id) {
        setStatus('✓ D1 已创建，保存 CF_D1_DATABASE_ID...')
        await saveSecret('CF_D1_DATABASE_ID', id)
        await sleep(500)
      } else {
        setStatus('D1 创建失败（未登录则无法创建），可手动在 secrets 面板补录')
        await sleep(1200)
      }
      continue
    }

    if (action === 'r2') {
      const name = await askInput('R2 桶名称:', { value: 'arwes-cms-media' })
      if (name === BACK) continue
      setStatus(`创建 R2 桶 ${name}...`)
      await sleep(300)
      try {
        runWrangler(`r2 bucket create ${name}`)
      } catch {
        // 忽略
      }
      await saveSecret('CF_R2_BUCKET_NAME', name)
      setStatus('✓ CF_R2_BUCKET_NAME 已保存')
      await sleep(500)
      continue
    }

    if (action === 'kv') {
      const name = await askInput('KV namespace 名称:', { value: 'arwes-cms-kv' })
      if (name === BACK) continue
      setStatus(`创建 KV ${name}...`)
      await sleep(300)
      let id = null
      try {
        const out = runWrangler(`kv namespace create ${name}`)
        id = extractId(out, /id\s*=\s*"([^"]+)"/) || extractId(out, /(\b[0-9a-f]{32}\b)/)
      } catch {
        id = null
      }
      if (id) {
        setStatus('✓ KV 已创建，保存 CF_KV_NAMESPACE_ID...')
        await saveSecret('CF_KV_NAMESPACE_ID', id)
        await sleep(500)
      } else {
        setStatus('KV 创建失败，可手动在 secrets 面板补录')
        await sleep(1200)
      }
      continue
    }

    if (action === 'secrets') {
      const accountId = await askInput('Cloudflare 账号 ID（dash.cloudflare.com 首页右下角）:', {})
      if (accountId === BACK) continue
      if (accountId.trim()) {
        cfAccountId = accountId.trim() // 存入内存供 wrangler 使用
        await saveSecret('CF_ACCOUNT_ID', cfAccountId)
      }
      const flareUrl = await askInput('CMS Worker URL（如 https://flare-cms.xxx.workers.dev）:', {
        value: 'https://flare-cms.your-subdomain.workers.dev'
      })
      if (flareUrl === BACK) continue
      if (flareUrl.trim() && !flareUrl.includes('your-subdomain')) {
        await saveSecret('FLARE_API_URL', flareUrl.trim())
      }
      setStatus('✓ Cloudflare 账号配置已保存')
      await sleep(600)
      continue
    }
  }
}

// ===========================================================================
// GitHub Actions 面板
// ===========================================================================

const panelActions = async () => {
  setTitle('⚡ GitHub Actions 控制台')

  for (;;) {
    const action = await askSelect('GitHub Actions:', [
      { name: '查看 Workflows', value: 'workflows' },
      { name: '查看最近 Runs', value: 'runs' },
      { name: '返回主菜单', value: 'exit' }
    ])
    if (action === BACK || action === 'exit') return

    if (action === 'workflows') {
      setStatus('查询 workflows...')
      const workflows = await githubListWorkflows(ghSession)
      if (!workflows) {
        setStatus('✗ 无法获取 workflow 列表（检查 token 权限）')
        await sleep(1200)
        continue
      }
      const lines = workflows.length
        ? workflows.map(
            (w) => `${w.state === 'active' ? '●' : '○'} ${w.name}  (${w.path})  runs: ${w.runCount}`
          )
        : ['（仓库暂无 workflow，.github/workflows/deploy.yml 应已包含）']
      const r = await showPanel('GitHub Actions Workflows', lines, 'Enter 返回，Esc 主菜单')
      await sleep(400)
      continue
    }

    if (action === 'runs') {
      setStatus('查询最近 runs...')
      const runs = await githubRecentRuns(ghSession)
      if (!runs) {
        setStatus('✗ 无法获取 runs')
        await sleep(1200)
        continue
      }
      const lines = runs.length
        ? runs.map(
            (r) => `  ${new Date(r.createdAt).toLocaleString()}  ${r.name}  → ${r.conclusion}`
          )
        : ['（暂无运行记录）']
      await showPanel('最近 Runs', lines, 'Enter 返回，Esc 主菜单')
      await sleep(400)
      continue
    }
  }
}

// ===========================================================================
// Backblaze B2 面板
// ===========================================================================

const b2SecretNames = [
  'STORAGE_BACKEND',
  'B2_ENDPOINT',
  'B2_BUCKET',
  'B2_ACCESS_KEY_ID',
  'B2_SECRET_ACCESS_KEY'
]

const panelB2 = async () => {
  setTitle('💾 Backblaze B2 存储')

  for (;;) {
    const secrets = (await githubListSecrets(ghSession)) || []
    const b2Configured = secrets.filter((s) => b2SecretNames.includes(s)).length

    clearContent()
    const box = makeBox({ title: 'Backblaze B2 状态', flexDirection: 'column' })
    box.add(
      makeText(
        b2Configured >= 5
          ? ' 状态: ✓ 已配置（B2 全套 secrets 已保存）'
          : b2Configured > 0
            ? ` 状态: ◐ 部分配置（${b2Configured}/5 项 secrets 已保存）`
            : ' 状态: ○ 未配置（默认使用 Cloudflare R2）'
      )
    )
    contentBox.add(box)

    const action = await askSelect('B2 操作:', [
      {
        name: b2Configured >= 5 ? '重新配置 B2' : '配置 B2（连接并保存 secrets）',
        value: 'config'
      },
      { name: '返回主菜单', value: 'exit' }
    ])
    if (action === BACK || action === 'exit') return

    if (action === 'config') {
      const en = await askInput('B2 S3 兼容端点:', {
        value: 'https://s3.us-west-004.backblazeb2.com'
      })
      if (en === BACK) continue
      const bucket = await askInput('B2 私有桶名:', { value: 'arwes-cms-media' })
      if (bucket === BACK) continue
      const keyId = await askInput('B2 Application Key ID:')
      if (keyId === BACK) continue
      const keySecret = await askInput('B2 Application Key Secret:')
      if (keySecret === BACK) continue

      setStatus('保存 B2 secrets...')
      await saveSecret('STORAGE_BACKEND', 'b2')
      await saveSecret('B2_ENDPOINT', en.trim())
      await saveSecret('B2_BUCKET', bucket.trim())
      await saveSecret('B2_ACCESS_KEY_ID', keyId.trim())
      await saveSecret('B2_SECRET_ACCESS_KEY', keySecret.trim())
      setStatus('✓ B2 配置已保存到 secrets')
      await sleep(800)
      continue
    }
  }
}

// ===========================================================================
// Secrets 面板
// ===========================================================================

const panelSecrets = async () => {
  setTitle('🔑 Secrets 管理')

  for (;;) {
    const secrets = (await githubListSecrets(ghSession)) || []
    clearContent()
    const box = makeBox({
      title: `GitHub Secrets（共 ${secrets.length} 个）`,
      flexDirection: 'column'
    })
    if (secrets.length === 0) {
      box.add(makeText('  （暂无 secrets）'))
    } else {
      for (const name of secrets) {
        box.add(makeText(`  ${name}`))
      }
    }
    contentBox.add(box)

    const action = await askSelect('Secrets 操作:', [
      { name: '新增 / 更新 secret', value: 'set' },
      { name: '返回主菜单', value: 'exit' }
    ])
    if (action === BACK || action === 'exit') return

    if (action === 'set') {
      const name = await askInput('Secret 名称（如 CF_API_TOKEN / JWT_SECRET）:', {
        hint: '大写字母与下划线'
      })
      if (name === BACK) continue
      if (!/^[A-Z][A-Z0-9_]*$/.test(name.trim())) {
        setStatus('✗ 名称需为大写下划线格式')
        await sleep(900)
        continue
      }
      const value = await askInput(`Secret 值（${name.trim()}）:`, {})
      if (value === BACK) continue
      if (value.trim()) {
        setStatus('保存...')
        const ok = await saveSecret(name.trim(), value.trim())
        setStatus(ok ? `✓ ${name.trim()} 已保存` : '✗ 保存失败')
        await sleep(700)
      }
      continue
    }
  }
}

// ===========================================================================
// 主界面
// ===========================================================================

const mainMenu = async () => {
  setTitle('🚀 ARWES + Flare CMS 控制台')
  setStatus('选择功能，Esc 返回上层，Ctrl+C 退出')

  const sel = await askSelect('主菜单:', [
    { name: '🌐 Cloudflare', description: '登录 / D1 / R2 / KV / 账号配置', value: 'cf' },
    { name: '⚡ GitHub Actions', description: 'workflows / 最近 runs', value: 'gh' },
    { name: '💾 Backblaze B2', description: '连接状态 / 配置', value: 'b2' },
    { name: '🔑 Secrets', description: '查看 / 新增 / 更新', value: 'secrets' },
    { name: '退出', value: 'exit' }
  ])
  if (sel === BACK) return
  return sel
}

const main = async () => {
  try {
    setTitle('🚀 ARWES + Flare CMS 控制台')
    setStatus('正在连接 GitHub...')

    // 唯一入口：GitHub WebAuth 登录
    const login = await askConfirm('登录 GitHub 以管理控制台？')
    if (login === BACK || !login) {
      setStatus('已取消')
      await sleep(800)
      destroyUi()
      process.exit(0)
    }

    const auth = await githubDeviceAuth()
    if (!auth.ok) {
      const retry = await askConfirm(`✗ GitHub 登录失败：${auth.error}\n重试？`)
      if (retry && retry !== BACK) {
        const auth2 = await githubDeviceAuth()
        if (!auth2.ok) {
          setStatus('✗ 登录失败，退出')
          await sleep(1500)
          destroyUi()
          process.exit(1)
        }
      } else {
        setStatus('已退出')
        await sleep(800)
        destroyUi()
        process.exit(0)
      }
    }

    setStatus(`✓ 已登录: ${ghSession.login} @ ${ghSession.repo}`)
    await sleep(800)

    // 主循环
    for (;;) {
      const choice = await mainMenu()
      if (choice === BACK) continue
      if (choice === 'exit') break

      if (choice === 'cf') {
        await panelCloudflare()
      } else if (choice === 'gh') {
        await panelActions()
      } else if (choice === 'b2') {
        await panelB2()
      } else if (choice === 'secrets') {
        await panelSecrets()
      }
    }

    setTitle('👋 已退出控制台')
    setStatus('下次运行 npm run setup 即可重新进入')
    await sleep(2000)
    destroyUi()
    process.exit(0)
  } catch (err) {
    setStatus(`✗ 出错: ${err.message}`)
    await sleep(3000)
    destroyUi()
    process.exit(1)
  }
}

await main()
