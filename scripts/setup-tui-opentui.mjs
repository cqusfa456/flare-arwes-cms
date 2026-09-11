#!/usr/bin/env node
/**
 * ARWES + Flare CMS 初始化向导 (OpenTUI)
 *
 * 交互式设置开发/部署所需的账号与资源，全部为交互式 TUI：
 *
 *   1. GitHub 登录（WebAuth 设备流，浏览器授权）—— 先行，作为 secrets 管理基础
 *   2. GitHub Actions 状态查看（可选）
 *   3. Cloudflare 登录 → 创建 D1/R2/KV → 每个值立即写入 GitHub secrets
 *   4. Backblaze B2（可选）→ 立即写入 GitHub secrets
 *   5. JWT_SECRET → 写入 GitHub secrets
 *   6. 本地 .dev.vars（默认不写，opt-in）
 *   7. 前端 .env
 *
 * GitHub 连接先行确保 secrets 能正常保存与管理，同时可查看 Actions 情况。
 *
 * 用法: node --experimental-ffi scripts/setup-tui-opentui.mjs
 *       npm run setup
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
// GitHub Secrets 管理器（连接 GitHub 后全局可用）
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

// 全局 secrets 状态：GitHub 授权完成后设置
let ghSession = null // { token, repo, login }

// 立即写入一个 secret（GitHub 已连接时）
const saveSecret = async (name, value) => {
  if (!ghSession) {
    setStatus(`⚠ 未连接 GitHub，跳过 ${name}`)
    await sleep(800)
    return false
  }
  if (!value) return false
  try {
    await githubSetSecret(ghSession.token, ghSession.repo, name, value)
    setStatus(`✓ secret ${name} 已保存`)
    await sleep(400)
    return true
  } catch (err) {
    setStatus(`✗ ${name} 保存失败: ${err.message.slice(0, 60)}`)
    await sleep(900)
    return false
  }
}

// ===========================================================================
// 步骤 1: GitHub OAuth Device Flow（浏览器授权）—— 先行
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

const stepGitHubAuth = async () => {
  setTitle('步骤 1/7 — GitHub 登录 (WebAuth)')

  const repo = getRepo()
  if (!repo) {
    setStatus('✗ 未找到 GitHub 远程仓库（git remote get-url origin），无法管理 secrets')
    await sleep(1500)
    return null
  }

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

  // 展示授权信息
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

  ghSession = { token, repo, login: user.login }
  setStatus(`✓ GitHub 授权完成 — ${user.login} @ ${repo}`)
  await sleep(1200)

  return ghSession
}

// 查询并展示 GitHub Actions workflow 状态（可选步骤）
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

const stepGitHubActions = async () => {
  setTitle('步骤 2/7 — GitHub Actions 状态')

  if (!ghSession) {
    setStatus('✗ 未连接 GitHub，跳过')
    await sleep(800)
    return
  }

  setStatus('查询 workflow 列表...')
  const workflows = await githubListWorkflows(ghSession)
  if (!workflows) {
    setStatus('✗ 无法获取 workflow 列表（检查 token 权限）')
    await sleep(1200)
    return
  }

  clearContent()
  const box = makeBox({ title: 'GitHub Actions Workflows', flexDirection: 'column' })
  if (workflows.length === 0) {
    box.add(makeText('  （仓库中暂无 workflow）'))
    box.add(makeText(' 部署 workflow 由 .github/workflows/deploy.yml 提供，仓库中应已包含。'))
  } else {
    for (const w of workflows) {
      box.add(
        makeText(
          `  ${w.state === 'active' ? '●' : '○'} ${w.name}  (${w.path})  runs: ${w.runCount}`
        )
      )
    }
  }
  contentBox.add(box)
  setStatus('以上为当前仓库的 Actions workflows')

  const seeMore = await askConfirm('查看最近运行状态？')
  if (seeMore && ghSession) {
    setStatus('查询最近 runs...')
    const runsRes = await fetch(
      `https://api.github.com/repos/${ghSession.repo}/actions/runs?per_page=8`,
      {
        headers: {
          Authorization: `Bearer ${ghSession.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    if (runsRes.ok) {
      const runs = await runsRes.json()
      clearContent()
      const runsBox = makeBox({ title: '最近 Runs', flexDirection: 'column' })
      for (const r of (runs.workflow_runs || []).slice(0, 8)) {
        runsBox.add(
          makeText(
            `  ${new Date(r.created_at).toLocaleString()}  ${r.name}  → ${r.conclusion || r.status}`
          )
        )
      }
      contentBox.add(runsBox)
    }
    setStatus('Actions 状态查看完成')
  }

  setStatus('✓ Actions 检查完成，继续下一步')
  await sleep(800)
}

// ===========================================================================
// 步骤 3: Cloudflare 登录
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
  setTitle('步骤 3/7 — Cloudflare 登录')

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
    setStatus('请在新终端中执行: cd cms/packages/cms && npx wrangler login，完成后按 Enter 继续')
    await askInput('完成后按 Enter 继续:', { hint: 'Enter 继续' })
    return { apiToken: null }
  }

  if (choice === 'token') {
    const token = await askInput('粘贴 Cloudflare API Token:', {
      hint: '需要 Workers Scripts: Edit, Pages: Edit, D1, R2, KV 权限'
    })
    // 立即保存到 GitHub secrets
    if (token.trim() && ghSession) {
      clearContent()
      setStatus('正在保存 CF_API_TOKEN...')
      await saveSecret('CF_API_TOKEN', token.trim())
      await sleep(400)
    }
    return { apiToken: token.trim() || null }
  }

  return { apiToken: null }
}

// ===========================================================================
// 步骤 4: 创建 Cloudflare 资源（每个值立即写入 secrets）
// ===========================================================================

const stepCloudflareResources = async (apiToken) => {
  setTitle('步骤 4/7 — Cloudflare 资源 (D1 / R2 / KV)')

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
    setStatus('✗ Cloudflare 未登录，跳过资源创建（可在后续手动填写 ID）')
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
  if (resourceInfo.d1Id) {
    setStatus('✓ D1 已创建，保存 CF_D1_DATABASE_ID...')
    await saveSecret('CF_D1_DATABASE_ID', resourceInfo.d1Id)
  } else {
    const manualD1 = await askInput('D1 ID（自动创建失败，手动粘贴，可留空）:', {})
    if (manualD1.trim()) {
      resourceInfo.d1Id = manualD1.trim()
      await saveSecret('CF_D1_DATABASE_ID', resourceInfo.d1Id)
    }
  }

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
  setStatus('✓ R2 桶就绪，保存 CF_R2_BUCKET_NAME...')
  await saveSecret('CF_R2_BUCKET_NAME', resourceInfo.r2Name)

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
  if (resourceInfo.kvId) {
    setStatus('✓ KV namespace 已创建，保存 CF_KV_NAMESPACE_ID...')
    await saveSecret('CF_KV_NAMESPACE_ID', resourceInfo.kvId)
  } else {
    const manualKv = await askInput('KV ID（自动创建失败，手动粘贴，可留空）:', {})
    if (manualKv.trim()) {
      resourceInfo.kvId = manualKv.trim()
      await saveSecret('CF_KV_NAMESPACE_ID', resourceInfo.kvId)
    }
  }

  // CF_ACCOUNT_ID
  const accountId = await askInput('Cloudflare 账号 ID（dash.cloudflare.com 首页右下角）:', {})
  if (accountId.trim()) await saveSecret('CF_ACCOUNT_ID', accountId.trim())

  // FLARE_API_URL
  const flareUrl = await askInput(
    'CMS Worker URL（如 https://flare-cms.xxx.workers.dev，可后填）:',
    {
      value: 'https://flare-cms.your-subdomain.workers.dev'
    }
  )
  if (flareUrl.trim() && !flareUrl.includes('your-subdomain')) {
    await saveSecret('FLARE_API_URL', flareUrl.trim())
  }

  return resourceInfo
}

// ===========================================================================
// 步骤 5: Backblaze B2（可选）→ 立即写入 secrets
// ===========================================================================

const stepB2 = async () => {
  setTitle('步骤 5/7 — Backblaze B2 存储（可选）')

  const useB2 = await askConfirm('使用 Backblaze B2 私有桶替代 R2 存储媒体？')
  if (!useB2) {
    setStatus('继续使用 Cloudflare R2')
    await sleep(600)
    return
  }

  const b2Endpoint = await askInput('B2 S3 兼容端点:', {
    value: 'https://s3.us-west-004.backblazeb2.com'
  })
  const b2Bucket = await askInput('B2 私有桶名:', { value: 'arwes-cms-media' })
  const b2KeyId = await askInput('B2 Application Key ID:')
  const b2KeySecret = await askInput('B2 Application Key Secret:')

  clearContent()
  setStatus('保存 B2 配置到 GitHub secrets...')
  await saveSecret('STORAGE_BACKEND', 'b2')
  await saveSecret('B2_ENDPOINT', b2Endpoint.trim())
  await saveSecret('B2_BUCKET', b2Bucket.trim())
  await saveSecret('B2_ACCESS_KEY_ID', b2KeyId.trim())
  await saveSecret('B2_SECRET_ACCESS_KEY', b2KeySecret.trim())
  setStatus('✓ B2 配置已保存')
  await sleep(800)
}

// ===========================================================================
// 步骤 6: JWT_SECRET + GH_TOKEN（按需）→ 写入 secrets
// ===========================================================================

const stepFinalSecrets = async () => {
  setTitle('步骤 6/7 — 剩余 secrets')

  if (!ghSession) {
    setStatus('✗ 未连接 GitHub，跳过')
    await sleep(800)
    return { jwtSecret: null }
  }

  // JWT_SECRET
  const jwtSecret = await askInput('JWT_SECRET（CMS 认证密钥，生产部署使用）:', {
    value: `arwes-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  })
  const hasJwt = jwtSecret.trim() && (await saveSecret('JWT_SECRET', jwtSecret.trim()))
  await sleep(300)

  // FLARE_API_TOKEN（只读 API token，可选）
  const flareToken = await askInput('CMS 只读 API Token（可选，留空跳过）:', {})
  if (flareToken.trim()) await saveSecret('FLARE_API_TOKEN', flareToken.trim())

  // GH_TOKEN：默认不上传，按需 opt-in
  const uploadGhToken = await askConfirm(
    '是否将本次 GitHub 登录 token 也上传为 secrets（GH_TOKEN）？\n默认否；仅当 Actions 需要以你的身份访问私有仓库时需要'
  )
  if (uploadGhToken) {
    await saveSecret('GH_TOKEN', ghSession.token)
  }

  return { jwtSecret: hasJwt ? jwtSecret.trim() : null }
}

// ===========================================================================
// 步骤 7: 本地配置（.dev.vars 可选 + .env）
// ===========================================================================

const stepLocalVars = async (jwtSecret) => {
  setTitle('步骤 7/7 — 本地与前端配置')

  if (jwtSecret) {
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
      await sleep(1000)
    } else {
      setStatus('已跳过本地写入（本地零留存）')
      await sleep(600)
    }
  }

  const apiUrl = await askInput('CMS API URL（本地开发用 http://localhost:8787）:', {
    value: 'http://localhost:8787'
  })
  writeFileSync(join(DOCS_DIR, '.env'), `PUBLIC_FLARE_API_URL=${apiUrl.trim()}\n`)
  setStatus(`✓ 已写入 ${join(DOCS_DIR, '.env')}`)
  await sleep(600)
}

// ===========================================================================
// 主流程
// ===========================================================================

const main = async () => {
  try {
    setTitle('🚀 ARWES + Flare CMS 初始化向导')
    setStatus('按 Ctrl+C 可随时退出')

    const proceed = await askConfirm('开始初始化？将按顺序配置 GitHub → Cloudflare → B2')
    if (!proceed) {
      setStatus('已取消')
      await sleep(800)
      destroyUi()
      process.exit(0)
    }

    // 1. GitHub 先行（secrets 管理基础）
    await stepGitHubAuth()
    if (!ghSession) {
      const cont = await askConfirm('GitHub 未连接。继续（secrets 将无法保存）？')
      if (!cont) {
        setStatus('已取消')
        await sleep(800)
        destroyUi()
        process.exit(0)
      }
    }

    // 2. GitHub Actions 状态
    await stepGitHubActions()

    // 3. Cloudflare 登录
    const cf = await stepCloudflareLogin()

    // 4. 创建资源（每个值立即写 secrets）
    await stepCloudflareResources(cf.apiToken)

    // 5. B2（可选）
    await stepB2()

    // 6. JWT + GH_TOKEN 等剩余 secrets
    const { jwtSecret } = await stepFinalSecrets()

    // 7. 本地配置
    await stepLocalVars(jwtSecret)

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
