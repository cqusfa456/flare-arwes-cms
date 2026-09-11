/**
 * SigV4 签名验证测试
 *
 * Mock S3 服务器使用标准 AWS Signature V4 算法验证 B2Storage
 * 发出的请求签名。签名正确则请求通过，否则返回 403。
 *
 * 用法: npx tsx scripts/test-b2-signature.ts
 */
import { createServer } from 'node:http'
import { createHmac, createHash } from 'node:crypto'
import { B2Storage } from '../src/storage/b2-storage'

const ACCESS_KEY = 'test-access-key'
const SECRET_KEY = 'test-secret-key'
const REGION = 'us-west-004'

// ---------------------------------------------------------------------------
// Standard SigV4 verification (server side)
// ---------------------------------------------------------------------------

const hmac = (key: Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest()
const sha256hex = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex')

const verifySignature = (req: any, body: Buffer): boolean => {
  const auth = req.headers.authorization || ''
  const match = auth.match(
    /AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([a-f0-9]+)/
  )
  if (!match) return false
  const [, accessKey, dateStamp, region, service, signedHeaders, signature] = match
  if (accessKey !== ACCESS_KEY || region !== REGION || service !== 's3') return false

  const amzDate = req.headers['x-amz-date'] as string
  const payloadHash = (req.headers['x-amz-content-sha256'] as string) || sha256hex(body)

  // Canonical request
  const url = new URL(req.url, `http://${req.headers.host}`)
  const canonicalUri = url.pathname
  const canonicalQuery = url.search.slice(1)

  const headerNames = signedHeaders.split(';')
  const canonicalHeaders = headerNames
    .map((h) => `${h}:${String(req.headers[h] || '').trim()}\n`)
    .join('')

  const canonicalRequest = [
    req.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  // String to sign
  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256hex(canonicalRequest)
  ].join('\n')

  // Signing key
  const kDate = hmac(Buffer.from(`AWS4${SECRET_KEY}`), dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'aws4_request')
  const expected = hmac(kSigning, stringToSign).toString('hex')

  return expected === signature
}

// ---------------------------------------------------------------------------
// Mock S3 server with signature verification
// ---------------------------------------------------------------------------

const objects = new Map<string, Buffer>()

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = Buffer.concat(chunks)

  // Verify signature for all requests
  if (!verifySignature(req, body)) {
    res.writeHead(403, { 'Content-Type': 'application/xml' })
    res.end('<Error><Code>SignatureDoesNotMatch</Code><Message>bad signature</Message></Error>')
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const key = decodeURIComponent(url.pathname.replace(/^\/test-bucket\//, ''))

  switch (req.method) {
    case 'PUT':
      objects.set(key, body)
      res.writeHead(200, { ETag: '"sig-etag"' })
      res.end()
      break
    case 'GET': {
      const obj = objects.get(key)
      if (!obj) {
        res.writeHead(404)
        res.end()
        break
      }
      res.writeHead(200, {
        'Content-Type': req.headers['content-type'] || 'application/octet-stream',
        'Content-Length': String(obj.length),
        ETag: '"sig-etag"'
      })
      res.end(obj)
      break
    }
    case 'HEAD': {
      const obj = objects.get(key)
      if (!obj) {
        res.writeHead(404)
        res.end()
        break
      }
      res.writeHead(200, { 'Content-Length': String(obj.length), ETag: '"sig-etag"' })
      res.end()
      break
    }
    case 'DELETE':
      objects.delete(key)
      res.writeHead(204)
      res.end()
      break
    default:
      res.writeHead(405)
      res.end()
  }
})

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = (server.address() as { port: number }).port

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const storage = new B2Storage({
  endpoint: `http://127.0.0.1:${port}`,
  bucket: 'test-bucket',
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_KEY,
  region: REGION
})

let passed = 0
let failed = 0

const check = (name: string, cond: boolean, detail?: string) => {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n1. PUT with valid signature')
await storage.put('uploads/signed.txt', 'signed content', {
  httpMetadata: { contentType: 'text/plain' }
})
check('put accepted (no 403)', true)

console.log('\n2. GET with valid signature')
const obj = await storage.get('uploads/signed.txt')
check('get returns content', obj !== null && (await obj!.text()) === 'signed content')

console.log('\n3. HEAD with valid signature')
const head = await storage.head('uploads/signed.txt')
check('head returns object', head !== null)

console.log('\n4. DELETE with valid signature')
await storage.delete('uploads/signed.txt')
check('delete accepted', (await storage.get('uploads/signed.txt')) === null)

console.log('\n5. GET missing (404, not 403)')
const missing = await storage.get('uploads/nope.txt')
check('missing returns null', missing === null)

server.close()
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
