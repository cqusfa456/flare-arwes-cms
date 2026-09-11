/**
 * B2Storage 端到端测试
 *
 * 启动一个本地 mock S3 服务器（不验证签名），然后通过 B2Storage
 * 执行 put/get/head/delete 完整流程，验证 R2Bucket 兼容接口。
 *
 * 用法: npx tsx scripts/test-b2-storage.ts
 */
import { createServer } from 'node:http'
import { B2Storage } from '../src/storage/b2-storage'

// ---------------------------------------------------------------------------
// Mock S3 server (in-memory)
// ---------------------------------------------------------------------------

const objects = new Map<string, { body: Buffer; headers: Record<string, string> }>()

// Case-insensitive header lookup (S3 headers are case-insensitive).
const getHeader = (headers: Record<string, string>, name: string): string | undefined => {
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v
  }
  return undefined
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const key = decodeURIComponent(url.pathname.replace(/^\/test-bucket\//, ''))

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const body = Buffer.concat(chunks)

  switch (req.method) {
    case 'PUT': {
      const headers: Record<string, string> = {}
      // Use rawHeaders to preserve original case (S3 spec keeps x-amz-meta-* case).
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers[req.rawHeaders[i]] = req.rawHeaders[i + 1]
      }
      objects.set(key, { body, headers })
      res.writeHead(200, { ETag: `"mock-etag-${key}"` })
      res.end()
      break
    }
    case 'GET': {
      const obj = objects.get(key)
      if (!obj) {
        res.writeHead(404)
        res.end()
        break
      }
      const headers: Record<string, string> = {
        'Content-Type': getHeader(obj.headers, 'content-type') || 'application/octet-stream',
        'Content-Length': String(obj.body.length),
        ETag: `"mock-etag-${key}"`
      }
      const contentDisposition = getHeader(obj.headers, 'content-disposition')
      if (contentDisposition) {
        headers['Content-Disposition'] = contentDisposition
      }
      for (const [k, v] of Object.entries(obj.headers)) {
        if (k.toLowerCase().startsWith('x-amz-meta-')) headers[k] = v
      }
      res.writeHead(200, headers)
      res.end(obj.body)
      break
    }
    case 'HEAD': {
      const obj = objects.get(key)
      if (!obj) {
        res.writeHead(404)
        res.end()
        break
      }
      res.writeHead(200, {
        'Content-Type': getHeader(obj.headers, 'content-type') || 'application/octet-stream',
        'Content-Length': String(obj.body.length),
        ETag: `"mock-etag-${key}"`
      })
      res.end()
      break
    }
    case 'DELETE': {
      objects.delete(key)
      res.writeHead(204)
      res.end()
      break
    }
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
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret'
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

// 1. put (string body)
console.log('\n1. put()')
const obj1 = await storage.put('uploads/test.txt', 'hello b2', {
  httpMetadata: { contentType: 'text/plain' },
  customMetadata: { originalName: 'test.txt', uploadedBy: 'admin' }
})
check('put returns object with key', obj1.key === 'uploads/test.txt')
check('put returns etag', obj1.httpEtag.includes('mock-etag'))

// 2. get
console.log('\n2. get()')
const obj2 = await storage.get('uploads/test.txt')
check('get returns object', obj2 !== null)
check('get body text matches', (await obj2!.text()) === 'hello b2')
check('get httpMetadata.contentType', obj2!.httpMetadata?.contentType === 'text/plain')
check('get customMetadata.originalName', obj2!.customMetadata?.originalname === 'test.txt')

// 3. head
console.log('\n3. head()')
const obj3 = await storage.head('uploads/test.txt')
check('head returns object', obj3 !== null)
check('head size', obj3!.size === 8)
const missing = await storage.head('uploads/missing.txt')
check('head missing returns null', missing === null)

// 4. get missing
console.log('\n4. get() missing')
const missing2 = await storage.get('uploads/missing.txt')
check('get missing returns null', missing2 === null)

// 5. put (ArrayBuffer)
console.log('\n5. put() ArrayBuffer')
const buf = new TextEncoder().encode('binary-data').buffer
await storage.put('uploads/data.bin', buf, { httpMetadata: { contentType: 'application/octet-stream' } })
const obj5 = await storage.get('uploads/data.bin')
check('binary roundtrip', (await obj5!.arrayBuffer()).byteLength === 11)

// 6. put (Blob)
console.log('\n6. put() Blob')
const blob = new Blob(['blob-content'], { type: 'text/plain' })
await storage.put('uploads/blob.txt', blob)
const obj6 = await storage.get('uploads/blob.txt')
check('blob roundtrip', (await obj6!.text()) === 'blob-content')

// 7. delete
console.log('\n7. delete()')
await storage.delete('uploads/test.txt')
const obj7 = await storage.get('uploads/test.txt')
check('delete removes object', obj7 === null)

// 8. delete (array)
console.log('\n8. delete() array')
await storage.put('uploads/a.txt', 'a')
await storage.put('uploads/b.txt', 'b')
await storage.delete(['uploads/a.txt', 'uploads/b.txt'])
check('delete array removes both', (await storage.get('uploads/a.txt')) === null && (await storage.get('uploads/b.txt')) === null)

// 9. writeHttpMetadata
console.log('\n9. writeHttpMetadata()')
const obj9 = await storage.get('uploads/data.bin')
const headers = new Headers()
obj9!.writeHttpMetadata(headers)
check('writeHttpMetadata sets Content-Type', headers.get('Content-Type') === 'application/octet-stream')

// 10. content type inference
console.log('\n10. content type inference')
await storage.put('uploads/photo.jpg', 'jpeg-data')
const obj10 = await storage.get('uploads/photo.jpg')
check('jpg inferred as image/jpeg', obj10!.httpMetadata?.contentType === 'image/jpeg')

// ---------------------------------------------------------------------------

server.close()
console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
