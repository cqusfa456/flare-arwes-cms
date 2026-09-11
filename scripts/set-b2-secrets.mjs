#!/usr/bin/env node
/**
 * 写入 B2 存储 secrets 到 GitHub Actions（一次性工具）
 * 用法: node scripts/set-b2-secrets.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProxyAgent, setGlobalDispatcher } from 'undici'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const STATE_FILE = join(ROOT, 'node_modules', '.oauth-state.json')

try {
  const p = execSync('git config --get http.proxy', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  if (p) {
    setGlobalDispatcher(new ProxyAgent(p))
    console.log(`[proxy] ${p}`)
  }
} catch {
  /* ignore */
}

const gh = JSON.parse(readFileSync(STATE_FILE, 'utf-8')).github
const headers = {
  Authorization: `Bearer ${gh.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
}

const secrets = {
  STORAGE_BACKEND: 'b2',
  B2_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
  B2_BUCKET: 'cqusfa',
  B2_ACCESS_KEY_ID: '005cb0679d36e820000000001',
  B2_SECRET_ACCESS_KEY: 'K005h8Wca0S4B1Rj1mBuwF/u+TDQIrU',
  B2_REGION: 'us-east-005'
}

let ok = 0
let fail = 0
for (const [name, value] of Object.entries(secrets)) {
  try {
    const pubRes = await fetch(
      `https://api.github.com/repos/${gh.repo}/actions/secrets/public-key`,
      { headers }
    )
    if (!pubRes.ok) throw new Error(`public-key ${pubRes.status}`)
    const { key_id, key } = await pubRes.json()

    const sodium = (await import('libsodium-wrappers')).default
    await sodium.ready
    const pubKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
    const encrypted = sodium.crypto_box_seal(new Uint8Array(Buffer.from(value)), pubKey)
    const encryptedValue = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL)

    const putRes = await fetch(`https://api.github.com/repos/${gh.repo}/actions/secrets/${name}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ encrypted_value: encryptedValue, key_id })
    })
    if (!putRes.ok && putRes.status !== 204) throw new Error(`set ${name} ${putRes.status}`)
    console.log(`✓ ${name}`)
    ok++
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`)
    fail++
  }
}
console.log(`\nB2 secrets: ${ok} 成功, ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
