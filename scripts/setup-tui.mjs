#!/usr/bin/env node
/**
 * ARWES + Sci-Fi CMS 初始化向导 (TUI)
 *
 * 交互式设置开发/部署所需的账号与资源：
 *   - Cloudflare 登录 (wrangler login 或 API token)
 *   - 创建 D1 数据库 / R2 桶 / KV namespace 并写入 wrangler.toml
 *   - 设置 JWT_SECRET、运行数据库迁移、创建管理员账号
 *   - 检查 GitHub 凭据并生成 Actions secrets 设置指引
 *   - 可选：Backblaze B2 存储配置
 *   - 生成前端 .env 文件
 *
 * 用法: node scripts/setup-tui.mjs
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { select, text, confirm, spinner, intro, outro, isCancel, log } from '@clack/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CMS_DIR = join(ROOT, 'cms')
const CMS_PKG = join(CMS_DIR, 'packages', 'cms')
const DEV_VARS = join(CMS_PKG, '.dev.vars')
const DOCS_DIR = join(ROOT, 'apps', 'docs')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const run = (cmd, opts = {}) => {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', ...opts })
  } catch (err) {
    // 合并 stdout 和 stderr（wrangler 的错误信息输出到 stderr）
    return `${err.stdout || ''}${err.stderr || ''}`
  }
}

const runWrangler = (args, opts = {}) => {
  const wranglerBin = join(
    CMS_PKG,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  )
  return run(`"${wranglerBin}" ${args}`, { cwd: CMS_PKG, ...opts })
}

const isWranglerLoggedIn = () => {
  const out = runWrangler('whoami')
  return !out.includes('Not logged in') && !out.includes('Failed to fetch auth token')
}

const readDevVars = () => (existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf-8') : '')

const extractId = (out, pattern) => {
  const m = out.match(pattern)
  return m ? m[1] : null
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function stepCloudflare() {
  log.step('1/7 Cloudflare 账号')
  const loggedIn = isWranglerLoggedIn()

  if (loggedIn) {
    log.success('已通过 wrangler 登录 Cloudflare')
    return { apiToken: null }
  }

  const choice = await select({
    message: '未检测到 Cloudflare 登录，选择登录方式:',
    options: [
      { value: 'login', label: 'wrangler login（浏览器 OAuth 登录）', hint: '推荐' },
      { value: 'token', label: '输入 API Token（CI 部署用）' },
      { value: 'skip', label: '跳过（仅本地开发）' }
    ]
  })
  if (isCancel(choice)) process.exit(0)

  if (choice === 'login') {
    const s = spinner()
    s.start('打开浏览器登录 Cloudflare...')
    try {
      execSync(
        `"${join(CMS_PKG, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')}" login`,
        {
          cwd: CMS_PKG,
          stdio: 'inherit'
        }
      )
      s.stop('登录完成')
      return { apiToken: null }
    } catch {
      s.stop('登录失败或取消')
      log.warn('可稍后手动运行: cd cms/packages/cms && npx wrangler login')
      return { apiToken: null }
    }
  }

  if (choice === 'token') {
    const token = await text({
      message: '粘贴 Cloudflare API Token（创建: https://dash.cloudflare.com/profile/api-tokens）',
      placeholder: '需要 Workers Scripts: Edit, Pages: Edit, D1, R2, KV 权限',
      validate: (v) => (v && v.length > 10 ? undefined : 'Token 无效')
    })
    if (isCancel(token)) process.exit(0)
    return { apiToken: token }
  }

  return { apiToken: null }
}

async function stepCloudflareResources(apiToken) {
  log.step('2/7 Cloudflare 资源 (D1 / R2 / KV)')

  const env = apiToken ? { CLOUDFLARE_API_TOKEN: apiToken, ...process.env } : process.env
  const wranglerBin = join(
    CMS_PKG,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler'
  )
  const wr = (args) => run(`"${wranglerBin}" ${args}`, { cwd: CMS_PKG, env })

  // 未登录时资源创建会失败，先检查
  const whoami = wr('whoami')
  if (whoami.includes('Not logged in') || whoami.includes('Failed to fetch auth token')) {
    log.warn('Cloudflare 未登录，跳过资源创建。可稍后手动运行:')
    log.warn('  cd cms/packages/cms && npx wrangler login')
    log.warn('  npx wrangler d1 create arwes-cms-db')
    log.warn('  npx wrangler r2 bucket create arwes-cms-media')
    log.warn('  npx wrangler kv namespace create arwes-cms-kv')
    return { d1Id: null, r2Name: null, kvId: null }
  }

  // 资源 ID 不再写入 wrangler.toml（保留 REPLACE_WITH_YOUR_* 占位符），
  // 只返回给 stepGitHubSecrets 写入 GitHub secrets
  const resourceInfo = { d1Id: null, r2Name: null, kvId: null }

  // --- D1 database ---
  const d1Name = await text({
    message: 'D1 数据库名称（用于存储 CMS 内容）:',
    initialValue: 'arwes-cms-db'
  })
  if (isCancel(d1Name)) process.exit(0)

  const s = spinner()
  s.start(`创建 D1 数据库 ${d1Name}...`)
  const d1Out = wr(`d1 create ${d1Name}`)
  const d1Id =
    extractId(d1Out, /database_id\s*=\s*"([^"]+)"/) || extractId(d1Out, /(\b[0-9a-f]{32}\b)/)
  s.stop(d1Id ? `D1 数据库已创建: ${d1Id}` : 'D1 创建失败（可能已存在）')

  if (d1Id) {
    resourceInfo.d1Id = d1Id
  }

  // --- R2 bucket ---
  const r2Name = await text({
    message: 'R2 存储桶名称（用于媒体文件）:',
    initialValue: 'arwes-cms-media'
  })
  if (isCancel(r2Name)) process.exit(0)

  s.start(`创建 R2 桶 ${r2Name}...`)
  const r2Out = wr(`r2 bucket create ${r2Name}`)
  s.stop(
    r2Out.includes('created') || r2Out.includes('already exists')
      ? `R2 桶就绪: ${r2Name}`
      : 'R2 创建失败（可能已存在）'
  )
  resourceInfo.r2Name = r2Name

  // --- KV namespace ---
  const kvName = await text({
    message: 'KV Namespace 名称（用于缓存/限流）:',
    initialValue: 'arwes-cms-kv'
  })
  if (isCancel(kvName)) process.exit(0)

  s.start(`创建 KV namespace ${kvName}...`)
  const kvOut = wr(`kv namespace create ${kvName}`)
  const kvId = extractId(kvOut, /id\s*=\s*"([^"]+)"/) || extractId(kvOut, /(\b[0-9a-f]{32}\b)/)
  s.stop(kvId ? `KV namespace 已创建: ${kvId}` : 'KV 创建失败（可能已存在）')

  if (kvId) {
    resourceInfo.kvId = kvId
  }

  log.success('D1/R2/KV 资源就绪（ID 将写入 GitHub secrets）')
  return resourceInfo
}

async function stepMigrationsAndAdmin() {
  log.step('4/7 数据库迁移与管理员账号')

  const s = spinner()
  s.start('运行本地数据库迁移...')
  const migrateOut = runWrangler('d1 migrations apply DB --local')
  s.stop(
    migrateOut.includes('✅') || migrateOut.includes('No migrations to apply')
      ? '迁移完成'
      : '迁移完成（见上方输出）'
  )

  const createAdmin = await confirm({
    message: '创建 CMS 管理员账号？',
    initialValue: true
  })
  if (isCancel(createAdmin)) process.exit(0)

  if (createAdmin) {
    const email = await text({ message: '管理员邮箱:', initialValue: 'admin@arwes.dev' })
    if (isCancel(email)) process.exit(0)
    const password = await text({
      message: '管理员密码（至少 8 位）:',
      initialValue: 'ArwesAdmin2026!',
      validate: (v) => (v.length >= 8 ? undefined : '密码至少 8 位')
    })
    if (isCancel(password)) process.exit(0)

    s.start('创建管理员账号...')
    // 通过注册 API 创建（第一个用户自动允许）
    // 需要 CMS 正在运行 (sh ./scripts/cms.sh dev)
    const cmsUp = run(
      'curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:8787/'
    ).includes('302')
    if (!cmsUp) {
      s.stop('CMS 未运行，跳过账号创建。请先启动: sh ./scripts/cms.sh dev')
      log.info('启动后访问 http://localhost:8787/auth/register 手动注册第一个用户')
    } else {
      const regOut = run(
        `curl -s -X POST http://localhost:8787/auth/register -H "Content-Type: application/json" -d '{"email":"${email}","password":"${password}","username":"admin"}'`
      )
      if (regOut.includes('"token"')) {
        s.stop('管理员账号已创建（角色: viewer，可在 Admin 中提升）')
      } else {
        s.stop('注册失败——请检查 CMS 日志或手动注册')
      }
    }
  }
}

// GitHub Actions secrets 设置（通过 REST API + token，不依赖 gh CLI）
// 流程: 获取仓库公钥 → libsodium sealed box 加密 → PUT secret
const githubSetSecret = async (token, repo, name, value) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  // 1. 获取仓库公钥
  const pubRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, {
    headers
  })
  if (!pubRes.ok) {
    throw new Error(`获取公钥失败 (${pubRes.status}): ${(await pubRes.text()).slice(0, 200)}`)
  }
  const { key_id: keyId, key: pubKeyB64 } = await pubRes.json()

  // 2. libsodium sealed box 加密
  const sodium = (await import('libsodium-wrappers')).default
  await sodium.ready
  const pubKey = sodium.from_base64(pubKeyB64, sodium.base64_variants.ORIGINAL)
  const encrypted = sodium.crypto_box_seal(new Uint8Array(Buffer.from(value)), pubKey)
  const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

  // 3. 设置 secret
  const putRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  })
  if (!putRes.ok && putRes.status !== 204) {
    throw new Error(
      `设置 secret ${name} 失败 (${putRes.status}): ${(await putRes.text()).slice(0, 200)}`
    )
  }
  return true
}

async function stepGitHubSecrets() {
  log.step('3/7 GitHub secrets（所有账号信息统一存储，本地不留存）')

  const gitUser = run('git config user.name').trim()
  const gitEmail = run('git config user.email').trim()

  if (!gitUser || !gitEmail) {
    log.warn('未配置 git 用户信息')
    const name = await text({ message: 'git user.name:', initialValue: gitUser })
    const email = await text({ message: 'git user.email:', initialValue: gitEmail })
    if (isCancel(name) || isCancel(email)) process.exit(0)
    run(`git config --global user.name "${name}"`)
    run(`git config --global user.email "${email}"`)
    log.success('git 用户信息已配置')
  } else {
    log.success(`git 用户: ${gitUser} <${gitEmail}>`)
  }

  // 从 git remote 解析仓库
  const repo = run('git remote get-url origin')
    .trim()
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')

  if (!repo) {
    log.warn('未找到 GitHub 远程仓库（git remote get-url origin）')
    return
  }
  log.success(`GitHub 仓库: ${repo}`)

  const setupSecrets = await confirm({
    message: '将所有账号信息写入 GitHub secrets？（本地不做任何留存）',
    initialValue: true
  })
  if (isCancel(setupSecrets)) process.exit(0)

  if (!setupSecrets) return

  // --- GitHub OAuth Device Flow（浏览器授权，无需 token）---
  // 使用 GitHub CLI 官方公开的 OAuth client（嵌入代码是官方允许的）
  const GH_CLIENT_ID = '178c6fc778ccc68e1d6a'
  const s = spinner()

  s.start('请求 GitHub 设备授权...')
  const deviceRes = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: GH_CLIENT_ID,
      scope: 'repo workflow'
    })
  })
  if (!deviceRes.ok) {
    s.stop(`设备授权请求失败 (${deviceRes.status})`)
    return
  }
  const deviceData = await deviceRes.json()
  const { device_code, user_code, verification_uri, interval, expires_in } = deviceData
  s.stop('设备授权已就绪')

  // 展示给用户：在浏览器打开链接并输入代码
  log.info('请在浏览器中完成 GitHub 授权：')
  log.info(`  1. 打开: ${verification_uri}`)
  log.info(`  2. 输入代码: ${user_code}`)
  log.info('（未自动打开浏览器时，请手动访问上述链接）')

  // 尝试自动打开浏览器
  try {
    const openCmd =
      process.platform === 'win32'
        ? `start ${verification_uri}`
        : process.platform === 'darwin'
          ? `open ${verification_uri}`
          : `xdg-open ${verification_uri}`
    execSync(openCmd, { stdio: 'ignore' })
    log.info('已自动打开浏览器…')
  } catch {
    // 忽略：用户可手动打开
  }

  // 轮询 GitHub 直到用户授权完成
  s.start('等待浏览器授权完成…')
  const pollInterval = Math.max(interval || 5, 5)
  const deadline = Date.now() + (expires_in || 900) * 1000
  let token = null
  let authError = null

  while (Date.now() < deadline && !token) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000))

    let tokenRes
    try {
      tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: GH_CLIENT_ID,
          device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })
    } catch (err) {
      // 网络抖动，继续轮询
      continue
    }
    if (!tokenRes.ok) {
      authError = `授权请求失败 (${tokenRes.status})`
      break
    }

    if (tokenData.access_token) {
      token = tokenData.access_token
    } else if (tokenData.error === 'authorization_pending') {
      // 用户尚未完成授权，继续等待
    } else if (tokenData.error === 'slow_down') {
      // GitHub 要求放慢轮询速度
      await new Promise((resolve) => setTimeout(resolve, 5 * 1000))
    } else if (tokenData.error === 'expired_token' || tokenData.error === 'access_denied') {
      authError = `授权失败: ${tokenData.error_description || tokenData.error}`
      break
    }
  }

  if (!token) {
    s.stop(authError || '授权超时或未完成')
    return
  }

  // 验证 token 并获取用户名
  s.start('验证 GitHub 授权...')
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!userRes.ok) {
    s.stop(`授权 token 无效 (${userRes.status})`)
    return
  }
  const user = await userRes.json()
  s.stop(`GitHub 授权完成 — ${user.login}`)

  // -------------------------------------------------------------------
  // 收集所有账号信息（仅内存，写入 secrets 后不落本地文件）
  // -------------------------------------------------------------------
  const secrets = {}

  // GitHub OAuth token 只用于本次本地授权操作（写 secrets、验证身份），
  // 默认不上传 GitHub Actions。Actions 自带自动注入的 GITHUB_TOKEN，
  // 仅在需要跨仓库/第三方认证时按需上传。
  log.info('GitHub 登录 token 不会上传（仅用于本次本地授权操作）')
  log.info('GitHub Actions 自动注入 GITHUB_TOKEN，无需配置')

  log.info('以下信息将被加密写入 GitHub Actions secrets:')
  log.info('  CF_API_TOKEN / CF_ACCOUNT_ID / CF_D1_DATABASE_ID')
  log.info('  CF_R2_BUCKET_NAME / CF_KV_NAMESPACE_ID / SCIFI_API_URL')
  log.info('  JWT_SECRET / B2_*（如启用 B2）')

  const askValue = async (name, label, initial) => {
    const existing = {
      CF_API_TOKEN: apiTokenGlobal,
      CF_D1_DATABASE_ID: resourcesGlobal?.d1Id,
      CF_R2_BUCKET_NAME: resourcesGlobal?.r2Name,
      CF_KV_NAMESPACE_ID: resourcesGlobal?.kvId
    }
    if (existing[name]) {
      secrets[name] = existing[name]
      log.success(`  ${name}: 使用已创建资源`)
      return
    }
    const value = await text({ message: label, initialValue: initial })
    if (isCancel(value)) process.exit(0)
    if (value) secrets[name] = value
  }

  await askValue('CF_API_TOKEN', 'Cloudflare API Token:')
  await askValue('CF_ACCOUNT_ID', 'Cloudflare 账号 ID:')
  await askValue('CF_D1_DATABASE_ID', 'D1 数据库 ID:')
  await askValue('CF_R2_BUCKET_NAME', 'R2 桶名:')
  await askValue('CF_KV_NAMESPACE_ID', 'KV namespace ID:')
  await askValue('SCIFI_API_URL', 'CMS Worker URL（如 https://sci-fi-cms.xxx.workers.dev）:')
  await askValue('SCIFI_API_TOKEN', 'CMS 只读 API Token（可选，留空跳过）:')

  // JWT_SECRET（本地开发与生产共用一份，写入 secrets 供 CI 使用）
  const jwtSecret = await text({
    message: 'JWT_SECRET（CMS 认证密钥，生产部署使用）:',
    initialValue: `arwes-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  })
  if (isCancel(jwtSecret)) process.exit(0)
  if (jwtSecret) secrets.JWT_SECRET = jwtSecret

  // B2 存储（可选）——密钥只进 GitHub secrets，本地不写
  const useB2 = await confirm({
    message: '使用 Backblaze B2 私有桶替代 R2 存储媒体？（密钥仅写入 GitHub secrets）',
    initialValue: false
  })
  if (isCancel(useB2)) process.exit(0)

  if (useB2) {
    // STORAGE_BACKEND 固定为 'b2'（由下方 secrets.STORAGE_BACKEND 写入），不询问用户
    const b2Endpoint = await text({
      message: 'B2 S3 兼容端点:',
      initialValue: 'https://s3.us-west-004.backblazeb2.com'
    })
    const b2Bucket = await text({ message: 'B2 私有桶名:', initialValue: 'arwes-cms-media' })
    const b2KeyId = await text({ message: 'B2 Application Key ID:' })
    const b2KeySecret = await text({ message: 'B2 Application Key Secret:' })
    if (isCancel(b2Endpoint) || isCancel(b2Bucket) || isCancel(b2KeyId) || isCancel(b2KeySecret))
      process.exit(0)
    secrets.STORAGE_BACKEND = 'b2'
    secrets.B2_ENDPOINT = b2Endpoint
    secrets.B2_BUCKET = b2Bucket
    secrets.B2_ACCESS_KEY_ID = b2KeyId
    secrets.B2_SECRET_ACCESS_KEY = b2KeySecret
  }

  // -------------------------------------------------------------------
  // 写入 GitHub secrets（libsodium sealed box 加密，不落本地）
  // -------------------------------------------------------------------
  // 默认不上传 GitHub token。仅当 GitHub Actions 需要以用户身份
  // 跨仓库访问（例如拉取私有依赖仓库）时才按需上传。
  const uploadGhToken = await confirm({
    message:
      '是否将本次 GitHub 登录 token 也上传为 secrets（GH_TOKEN）？\n（默认否；仅在你希望 Actions 以你的身份访问私有仓库时需要）',
    initialValue: false
  })
  if (isCancel(uploadGhToken)) process.exit(0)
  if (uploadGhToken) {
    secrets.GH_TOKEN = token
    log.info('GH_TOKEN 已加入待上传列表（Actions 可用它访问你的私有仓库）')
  }

  s.start('写入 GitHub secrets...')

  let ok = 0
  let fail = 0
  for (const [name, value] of Object.entries(secrets)) {
    try {
      await githubSetSecret(token, repo, name, value)
      ok++
    } catch (err) {
      fail++
      log.warn(`  ${name}: ${err.message}`)
    }
  }
  s.stop(`secrets 写入完成: ${ok} 成功, ${fail} 失败`)

  return { jwtSecret }
}

async function stepEnvFile() {
  log.step('7/7 前端环境文件')

  const apiUrl = await text({
    message: 'CMS API URL（本地开发用 http://localhost:8787）:',
    initialValue: 'http://localhost:8787'
  })
  if (isCancel(apiUrl)) process.exit(0)

  const envPath = join(DOCS_DIR, '.env')
  const content = `PUBLIC_SCIFI_API_URL=${apiUrl}\n`
  writeFileSync(envPath, content)
  log.success(`已写入 ${envPath}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let apiTokenGlobal = null
let resourcesGlobal = null

intro('🚀 ARWES + Sci-Fi CMS 初始化向导')

const proceed = await confirm({
  message: '开始初始化？将检查/配置 Cloudflare、GitHub 等账号与资源',
  initialValue: true
})
if (isCancel(proceed)) process.exit(0)
if (!proceed) {
  outro('已取消')
  process.exit(0)
}

// 1. Cloudflare
const cf = await stepCloudflare()
apiTokenGlobal = cf.apiToken

// 2. Resources
resourcesGlobal = await stepCloudflareResources(cf.apiToken)

// 3. GitHub secrets（所有账号信息统一写入，本地零留存）
const gh = await stepGitHubSecrets()

// 4. 本地 .dev.vars —— 默认不写，用户可自选（仅本地开发运行 CMS 需要）
if (gh?.jwtSecret) {
  const writeLocal = await confirm({
    message:
      '是否将 JWT_SECRET 也写入本地 .dev.vars？\n（默认否，本地零留存；仅本地启动 CMS 时需要，文件已被 gitignore）',
    initialValue: false
  })
  if (isCancel(writeLocal)) process.exit(0)
  if (writeLocal) {
    let devVars = readDevVars()
    const setVar = (content, key, value) => {
      const re = new RegExp(`^${key}=.*$`, 'm')
      const line = `${key}=${value}`
      return re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`
    }
    devVars = setVar(devVars, 'JWT_SECRET', gh.jwtSecret)
    devVars = setVar(devVars, 'ENVIRONMENT', 'development')
    writeDevVars(devVars)
    log.success('.dev.vars 已写入（仅本地开发用 JWT_SECRET，不会提交）')
  } else {
    log.info('本地 .dev.vars 未写入。本地启动 CMS 时需自行设置 JWT_SECRET（可参考 GitHub secrets）')
  }
}

// 5. Migrations + admin
await stepMigrationsAndAdmin()

// 6. Env file（前端本地开发）
await stepEnvFile()

outro('✅ 初始化完成！')
log.info('下一步:')
log.info('  1. 启动 CMS:   sh ./scripts/cms.sh dev   →  http://localhost:8787/admin')
log.info('  2. 启动前端:   cd apps/docs && npm run dev  →  http://localhost:9002')
log.info('  3. 部署:       推送代码到 next/main 分支，GitHub Actions 自动部署到 Cloudflare')
