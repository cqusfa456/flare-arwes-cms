#!/usr/bin/env node
/**
 * Create — or reset — the CMS admin account in the deployed D1 database.
 *
 * Why this exists: a fresh database has no administrator, and the only other
 * way in was `POST /auth/seed-admin`, which is public, hard-codes
 * `arwes-admin!` and resets an existing admin's password. This script writes the
 * account straight into D1 with the same hash scheme the Worker verifies
 * (`cms/packages/core/src/middleware/auth.ts`):
 *
 *     pbkdf2:100000:<salt_hex>:<hash_hex>      PBKDF2-SHA256, 32-byte key
 *
 * It is also what `scripts/setup-tui.mjs` calls during initialisation, so the
 * first admin can be created as part of that flow.
 *
 * Usage
 * -----
 *   node scripts/create-admin.mjs --email you@example.com [--username admin] \
 *        [--password ...] [--database sci-fi-cms-db] [--local]
 *
 * Environment
 * -----------
 *   SCIFI_ADMIN_EMAIL / SCIFI_ADMIN_USERNAME / SCIFI_ADMIN_PASSWORD
 *   CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID   (wrangler credentials)
 *
 * The password is never printed and never written to disk.
 */
import { execFileSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CMS_PKG = join(ROOT, 'cms', 'packages', 'cms')
const PBKDF2_ITERATIONS = 100000

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const value = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const local = flag('local')
const databaseName = value('database', process.env.CF_D1_DATABASE_NAME || 'sci-fi-cms-db')
let email = (value('email', process.env.SCIFI_ADMIN_EMAIL || '') || '').trim().toLowerCase()
let username = (value('username', process.env.SCIFI_ADMIN_USERNAME || '') || '').trim() || 'admin'
let password = value('password', process.env.SCIFI_ADMIN_PASSWORD || '')

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/** Same derivation as AuthManager.hashPassword(). */
const hashPassword = (plain) => {
  const salt = randomBytes(16)
  const derived = pbkdf2Sync(plain, salt, PBKDF2_ITERATIONS, 32, 'sha256')
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt.toString('hex')}:${derived.toString('hex')}`
}

/** Read one line from the terminal, hiding the echo for password entry. */
const prompt = (question, { hidden = false } = {}) =>
  new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      const write = rl._writeToOutput?.bind(rl)
      rl._writeToOutput = (chunk) => {
        if (chunk.includes(question)) write?.(chunk)
        else write?.('*')
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer.trim())
    })
  })

const wrangler = (args) =>
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', ...args], {
    cwd: CMS_PKG,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

const sqlQuote = (text) => `'${String(text).replace(/'/g, "''")}'`

const resolveDatabaseId = () => {
  const raw = wrangler(['d1', 'list', '--json'])
  const start = raw.indexOf('[')
  if (start < 0) fail(`could not read the D1 list:\n${raw.slice(0, 400)}`)
  const databases = JSON.parse(raw.slice(start))
  const match = databases.find((db) => db.name === databaseName)
  if (!match) {
    fail(
      `D1 database "${databaseName}" not found.\n` +
        '  Deploy the CMS once first (GitHub Actions → Deploy to Cloudflare, or\n' +
        '  `npx wrangler deploy --env production` in cms/packages/cms): the deploy\n' +
        '  creates the database, and the Worker applies migrations on first request.'
    )
  }
  return match.uuid
}

const main = async () => {
  if (!email) email = (await prompt('管理员邮箱: ')).toLowerCase()
  if (!email.includes('@')) fail(`"${email}" does not look like an email address`)
  if (!username) username = (await prompt('管理员用户名 [admin]: ')) || 'admin'
  while (!password || password.length < 8) {
    if (password) console.error('  密码至少 8 位')
    password = await prompt('管理员密码（至少 8 位，输入不回显）: ', { hidden: true })
  }

  const databaseId = resolveDatabaseId()
  const passwordHash = hashPassword(password)
  const now = Date.now()
  const id = `admin-${now}-${randomUUID().slice(0, 8)}`

  // One command, two statements: update first, insert only when the email is new.
  // INSERT OR REPLACE would rewrite the primary key and orphan content rows that
  // reference users(id) through author_id.
  const sql = [
    `UPDATE users SET password_hash = ${sqlQuote(passwordHash)}, role = 'admin', is_active = 1, updated_at = ${now} WHERE email = ${sqlQuote(email)};`,
    `INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, is_active, created_at, updated_at)`,
    `SELECT ${sqlQuote(id)}, ${sqlQuote(email)}, ${sqlQuote(username)}, 'Admin', 'User', ${sqlQuote(passwordHash)}, 'admin', 1, ${now}, ${now}`,
    `WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = ${sqlQuote(email)});`
  ].join('\n')

  console.log(`D1 ${databaseName} (${databaseId}) — ${local ? 'local' : 'remote'}`)
  try {
    const out = wrangler([
      'd1',
      'execute',
      databaseName,
      local ? '--local' : '--remote',
      '--command',
      sql
    ])
    console.log(out.trim().split('\n').slice(0, 6).join('\n'))
  } catch (error) {
    const detail = `${error.stdout || ''}${error.stderr || ''}`.trim()
    if (/no such table/i.test(detail)) {
      fail(
        'the "users" table does not exist yet. Open the deployed Worker URL once —\n' +
          '  the runtime applies migrations on the first request — then run this again.\n' +
          `  ${detail.slice(0, 300)}`
      )
    }
    fail(`wrangler d1 execute failed:\n${detail.slice(0, 600)}`)
  }

  console.log(`✓ admin ready: ${email} (username ${username}, role admin)`)
  console.log('  登录后请立即在 Admin → 设置 中修改密码。')
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
