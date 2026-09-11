#!/usr/bin/env node
/**
 * ARWES + Flare CMS 初始化向导 (OpenTUI)
 *
 * 交互式设置开发/部署所需的账号与资源，全部为交互式 TUI：
 *   - Cloudflare 登录 (wrangler login 或 API token)
 *   - 创建 D1 数据库 / R2 桶 / KV namespace
 *   - GitHub OAuth Device Flow（浏览器授权，无需 token）
 *   - 收集所有账号信息，写入 GitHub secrets（本地零留存）
 *
 * 用法: node --experimental-ffi scripts/setup-tui-opentui.mjs
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderableEvents,
  createCliRenderer
} from '@opentui/core'

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
    height: Math.min(options.length + 1, 12),
    ...opts
  })

// 全屏布局：顶部标题、中部内容、底部状态
const mainBox = makeBox({
  title: '🚀 ARWES + Flare CMS 初始化向导',
  flexDirection: 'column',
  titleColor: '#00ff00'
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

// 清空内容区
const clearContent = () => {
  for (const child of contentBox.getChildren()) {
    contentBox.remove(child)
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ===========================================================================
// 交互辅助：选择 / 输入
// ===========================================================================

// 弹出一个选择列表，等待用户选择并回车。返回所选 option 的 value。
const askSelect = (prompt, options) =>
  new Promise((resolve) => {
    clearContent()
    const promptText = makeText(` ${prompt}`, { height: 1 })
    const select = makeSelect(options)
    contentBox.add(promptText)
    contentBox.add(select)

    setStatus('↑↓ 选择，Enter 确认，Ctrl+C 退出')
    select.focus()

    // ITEM_SELECTED 事件载荷为 (index, option)
    const onSelect = (_index, option) => {
      select.off(SelectRenderableEvents.ITEM_SELECTED, onSelect)
      resolve(option.value)
    }
    select.on(SelectRenderableEvents.ITEM_SELECTED, onSelect)
  })

// 弹出单行输入，等待 Enter。返回输入值。
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

    setStatus(options.hint ?? '输入内容，Enter 确认，Ctrl+C 退出')
    input.focus()

    const onEnter = (value) => {
      input.off(InputRenderableEvents.ENTER, onEnter)
      resolve(value)
    }
    input.on(InputRenderableEvents.ENTER, onEnter)
  })

// 确认提示（默认选中 yes/no）
const askConfirm = (prompt) =>
  askSelect(prompt, [
    { name: 'Yes', value: true },
    { name: 'No', value: false }
  ])

// ===========================================================================
// 步骤 1: Cloudflare 登录
// ===========================================================================

const runWrangler = (args, opts = {}) => {
  const wranglerBin = join(
    CMS_PKG,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  )
  try {
    return execSync(`"${wranglerBin}" ${args}`, {
      cwd: CMS_PKG,
      stdio: 'pipe',
      encoding: 'utf-8',
      ...opts
    })
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`
  }
}

const isWranglerLoggedIn = () => {
  const out = runWrangler('whoami')
  return !out.includes('Not logged in') && !out.includes('Failed to fetch auth token')
}

const extractId = (out, pattern) => {
  const m = out.match(pattern)
  return m ? m[1] : null
}

const stepCloudflareLogin = async () => {
  setTitle('步骤 1/6 — Cloudflare 登录')

  if (isWranglerLoggedIn()) {
    setStatus('✓ 已通过 wrangler 登录 Cloudflare')
    await sleep(800)
    return { apiToken: null }
  }

  const choice = await askSelect('未检测到 Cloudflare 登录，选择登录方式:', [
    { name: 'wrangler login（浏览器 OAuth 登录）', description: '推荐', value: 'login' },
    { name: '输入 API Token（CI/自动创建资源用）', value: 'token' },
    { name: '跳过（仅本地开发）', value: 'skip' }
  ])

  if (choice === 'login') {
    setStatus('打开浏览器登录 Cloudflare... 完成后回到此窗口')
    // 在子进程中运行 wrangler login（需要终端交互，所以用 stdio: inherit）
    // 注意：这会和 OpenTUI 抢占终端，简单做法是提示用户另开终端执行
    setStatus('请在新终端中执行: cd cms/packages/cms && npx wrangler login，完成后按任意键继续')
    await askInput('完成后按 Enter 继续:', { hint: 'Enter 继续' })
    return { apiToken: null }
  }

  if (choice === 'token') {
    const token = await askInput('粘贴 Cloudflare API Token:', {
      hint: '需要 Workers Scripts: Edit, Pages: Edit, D1, R2, KV 权限'
    })
    await sleep(300)
    return { apiToken: token.trim() || null }
  }

  return { apiToken: null }
}

// ===========================================================================
// 步骤 2: 创建 Cloudflare 资源
// ===========================================================================

const stepCloudflareResources = async (apiToken) => {
  setTitle('步骤 2/6 — Cloudflare 资源 (D1 / R2 / KV)')

  const env = apiToken ? { CLOUDFLARE_API_TOKEN: apiToken, ...process.env } : process.env
  const wranglerBin = join(
    CMS_PKG,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  )
  const wr = (args) =>
    execSync(`"${wranglerBin}" ${args}`, {
      cwd: CMS_PKG,
      stdio: 'pipe',
      encoding: 'utf-8',
      env
    })

  const whoami = wr('whoami')
  if (whoami.includes('Not logged in') || whoami.includes('Failed to fetch auth token')) {
    setStatus('✗ Cloudflare 未登录，跳过资源创建（可在 TUI 后续步骤手动填写 ID）')
    await sleep(1200)
    return { d1Id: null, r2Name: null, kvId: null }
  }

  const resourceInfo = { d1Id: null, r2Name: null, kvId: null }

  // D1
  const d1Name = await askInput('D1 数据库名称（用于存储 CMS 内容）:', { value: 'arwes-cms-db' })
  setStatus(`正在创建 D1 数据库 ${d1Name}...`)
  await sleep(300)
  try {
    const d1Out = wr(`d1 create ${d1Name}`)
    resourceInfo.d1Id =
      extractId(d1Out, /database_id\s*=\s*"([^"]+)"/) || extractId(d1Out, /(\b[0-9a-f]{32}\b)/)
  } catch {
    resourceInfo.d1Id = null
  }
  setStatus(resourceInfo.d1Id ? `✓ D1 已创建` : 'D1 创建失败（可能已存在，稍后可手动填 ID）')
  await sleep(800)

  // R2
  const r2Name = await askInput('R2 存储桶名称（用于媒体文件）:', { value: 'arwes-cms-media' })
  setStatus(`正在创建 R2 桶 ${r2Name}...`)
  await sleep(300)
  try {
    wr(`r2 bucket create ${r2Name}`)
    resourceInfo.r2Name = r2Name
  } catch {
    resourceInfo.r2Name = r2Name
  }
  setStatus(`✓ R2 桶就绪: ${r2Name}`)
  await sleep(800)

  // KV
  const kvName = await askInput('KV Namespace 名称（用于缓存/限流）:', { value: 'arwes-cms-kv' })
  setStatus(`正在创建 KV namespace ${kvName}...`)
  await sleep(300)
  try {
    const kvOut = wr(`kv namespace create ${kvName}`)
    resourceInfo.kvId =
      extractId(kvOut, /id\s*=\s*"([^"]+)"/) || extractId(kvOut, /(\b[0-9a-f]{32}\b)/)
  } catch {
    resourceInfo.kvId = null
  }
  setStatus(resourceInfo.kvId ? '✓ KV namespace 已创建' : 'KV 创建失败（稍后可手动填 ID）')
  await sleep(800)

  return resourceInfo
}

// ===========================================================================
// 步骤 3: GitHub OAuth Device Flow（浏览器授权）
// ===========================================================================

const stepGitHubAuth = async () => {
  setTitle('步骤 3/6 — GitHub 登录 (WebAuth)')

  const GH_CLIENT_ID = '178c6fc778ccc68e1d6a'

  setStatus('请求 GitHub 设备授权...')
  const deviceRes = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: GH_CLIENT_ID, scope: 'repo workflow' })
  })
  if (!deviceRes.ok) {
    setStatus(`✗ 设备授权请求失败 (${deviceRes.status})`)
    await sleep(1500)
    return null
  }
  const deviceData = await deviceRes.json()
  const { device_code, user_code, verification_uri } = deviceData

  // 展示授权信息（用 Box 突出显示一次性代码）
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

  setStatus('等待浏览器授权完成…（或按 Ctrl+C 取消）')

  // 轮询
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
    setStatus('✗ 授权超时或未完成')
    await sleep(1500)
    return null
  }

  // 验证并获取用户名
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!userRes.ok) {
    setStatus(`✗ 授权 token 无效 (${userRes.status})`)
    await sleep(1500)
    return null
  }
  const user = await userRes.json()
  setStatus(`✓ GitHub 授权完成 — ${user.login}`)
  await sleep(1000)

  return { token, repo: getRepo(), login: user.login }
}

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
// 步骤 4: 写入 GitHub secrets
// ===========================================================================

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

const stepGitHubSecrets = async (gh, resources, apiTokenGlobal) => {
  setTitle('步骤 4/6 — 写入 GitHub secrets')

  if (!gh || !gh.token) {
    setStatus('✗ 未完成 GitHub 授权，跳过 secrets 写入')
    await sleep(1200)
    return { jwtSecret: null }
  }

  const { token, repo } = gh

  const setupSecrets = await askConfirm('将所有账号信息写入 GitHub secrets？（本地不做任何留存）')
  if (!setupSecrets) {
    setStatus('已跳过 secrets 写入')
    await sleep(1000)
    return { jwtSecret: null }
  }

  const secrets = {}

  const askValue = async (name, label, initial) => {
    if (initial) {
      setStatus(`自动使用已创建/已输入值: ${name}`)
      secrets[name] = initial
      await sleep(300)
      return
    }
    const value = await askInput(label, {})
    if (value.trim()) secrets[name] = value.trim()
  }

  await askValue('CF_API_TOKEN', 'Cloudflare API Token:', apiTokenGlobal)
  await askValue('CF_ACCOUNT_ID', 'Cloudflare 账号 ID:', null)
  await askValue('CF_D1_DATABASE_ID', 'D1 数据库 ID:', resources?.d1Id)
  await askValue('CF_R2_BUCKET_NAME', 'R2 桶名:', resources?.r2Name)
  await askValue('CF_KV_NAMESPACE_ID', 'KV namespace ID:', resources?.kvId)
  await askValue('FLARE_API_URL', 'CMS Worker URL（如 https://flare-cms.xxx.workers.dev）:', null)
  await askValue('FLARE_API_TOKEN', 'CMS 只读 API Token（可选，留空跳过）:', null)

  // JWT_SECRET
  const jwtSecret = await askInput('JWT_SECRET（CMS 认证密钥，生产部署使用）:', {
    value: `arwes-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  })
  if (jwtSecret.trim()) secrets.JWT_SECRET = jwtSecret.trim()

  // B2（可选）
  const useB2 = await askConfirm(
    '使用 Backblaze B2 私有桶替代 R2 存储媒体？（密钥仅写入 GitHub secrets）'
  )
  if (useB2) {
    const b2Endpoint = await askInput('B2 S3 兼容端点:', {
      value: 'https://s3.us-west-004.backblazeb2.com'
    })
    const b2Bucket = await askInput('B2 私有桶名:', { value: 'arwes-cms-media' })
    const b2KeyId = await askInput('B2 Application Key ID:')
    const b2KeySecret = await askInput('B2 Application Key Secret:')
    secrets.STORAGE_BACKEND = 'b2'
    secrets.B2_ENDPOINT = b2Endpoint.trim()
    secrets.B2_BUCKET = b2Bucket.trim()
    secrets.B2_ACCESS_KEY_ID = b2KeyId.trim()
    secrets.B2_SECRET_ACCESS_KEY = b2KeySecret.trim()
  }

  // GitHub token：默认不上传，按需 opt-in
  const uploadGhToken = await askConfirm(
    '是否将本次 GitHub 登录 token 也上传为 secrets（GH_TOKEN）？\n默认否；仅当 Actions 需要以你的身份访问私有仓库时需要'
  )
  if (uploadGhToken) {
    secrets.GH_TOKEN = token
    setStatus('GH_TOKEN 已加入待上传列表')
    await sleep(300)
  }

  // 写入
  setStatus('正在写入 GitHub secrets...')
  let ok = 0
  let fail = 0
  for (const [name, value] of Object.entries(secrets)) {
    try {
      await githubSetSecret(token, repo, name, value)
      ok++
    } catch (err) {
      fail++
      setStatus(`  ${name}: 写入失败（${err.message.slice(0, 60)}）`)
      await sleep(500)
    }
  }
  setStatus(`✓ secrets 写入完成: ${ok} 成功, ${fail} 失败`)
  await sleep(1500)

  return { jwtSecret: jwtSecret.trim() }
}

// ===========================================================================
// 步骤 5: 本地 .dev.vars（默认不写）
// ===========================================================================

const stepLocalVars = async (jwtSecret) => {
  setTitle('步骤 5/6 — 本地开发配置')

  if (!jwtSecret) {
    setStatus('跳过（无 JWT_SECRET）')
    await sleep(800)
    return
  }

  const writeLocal = await askConfirm(
    '是否将 JWT_SECRET 也写入本地 .dev.vars？\n（默认否，本地零留存；仅本地启动 CMS 时需要，文件已被 gitignore）'
  )
  if (writeLocal) {
    let devVars = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf-8') : ''
    const setVar = (content, key, value) => {
      const re = new RegExp(`^${key}=.*$`, 'm')
      const line = `${key}=${value}`
      return re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`
    }
    devVars = setVar(devVars, 'JWT_SECRET', jwtSecret)
    devVars = setVar(devVars, 'ENVIRONMENT', 'development')
    writeFileSync(DEV_VARS, devVars)
    setStatus('✓ .dev.vars 已写入（仅本地开发用，不会提交）')
    await sleep(1200)
  } else {
    setStatus('已跳过本地写入（本地零留存）')
    await sleep(800)
  }
}

// ===========================================================================
// 步骤 6: 前端 .env
// ===========================================================================

const stepEnvFile = async () => {
  setTitle('步骤 6/6 — 前端环境文件')

  const apiUrl = await askInput('CMS API URL（本地开发用 http://localhost:8787）:', {
    value: 'http://localhost:8787'
  })
  writeFileSync(join(DOCS_DIR, '.env'), `PUBLIC_FLARE_API_URL=${apiUrl.trim()}\n`)
  setStatus(`✓ 已写入 ${join(DOCS_DIR, '.env')}`)
  await sleep(800)
}

// ===========================================================================
// 主流程
// ===========================================================================

const main = async () => {
  try {
    setTitle('🚀 ARWES + Flare CMS 初始化向导')
    setStatus('按 Ctrl+C 可随时退出')

    const proceed = await askConfirm('开始初始化？将检查/配置 Cloudflare、GitHub 等账号与资源')
    if (!proceed) {
      setStatus('已取消')
      await sleep(800)
      destroyUi()
      process.exit(0)
    }

    let apiTokenGlobal = null

    // 1. Cloudflare 登录
    const cf = await stepCloudflareLogin()
    apiTokenGlobal = cf.apiToken

    // 2. 创建资源
    const resources = await stepCloudflareResources(cf.apiToken)

    // 3. GitHub WebAuth
    const gh = await stepGitHubAuth()

    // 4. 写入 secrets
    const { jwtSecret } = await stepGitHubSecrets(gh, resources, apiTokenGlobal)

    // 5. 本地开发配置
    await stepLocalVars(jwtSecret)

    // 6. 前端 .env
    await stepEnvFile()

    setTitle('✅ 初始化完成！')
    setStatus(
      '下一步: 1) sh ./scripts/cms.sh dev  2) cd apps/docs && npm run dev  3) 推送触发自动部署'
    )
    await sleep(4000)

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
