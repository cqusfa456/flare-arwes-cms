/**
 * B2Storage — Backblaze B2 storage adapter for Flare CMS.
 *
 * Implements the R2Bucket-compatible interface (put/get/delete/head)
 * using the Backblaze B2 S3-compatible API with AWS Signature V4.
 *
 * Enable by setting STORAGE_BACKEND=b2 and the B2_* environment
 * variables in wrangler.toml / .dev.vars.
 */

// ---------------------------------------------------------------------------
// Types (R2Bucket-compatible subset)
// ---------------------------------------------------------------------------

interface B2HttpMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

interface B2PutOptions {
  httpMetadata?: B2HttpMetadata
  customMetadata?: Record<string, string>
}

interface B2Object {
  key: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  httpMetadata?: B2HttpMetadata
  customMetadata?: Record<string, string>
  writeHttpMetadata(headers: Headers): void
}

interface B2ObjectBody extends B2Object {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T>(): Promise<T>
  blob(): Promise<Blob>
}

// ---------------------------------------------------------------------------
// AWS Signature V4 helpers
// ---------------------------------------------------------------------------

const sha256 = async (data: string | ArrayBuffer): Promise<string> => {
  const buf = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const hmac = async (key: ArrayBuffer | Uint8Array, data: string): Promise<Uint8Array> => {
  const keyBuf = key instanceof Uint8Array ? (key.buffer as ArrayBuffer) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
  return new Uint8Array(sig)
}

const hmacHex = async (key: ArrayBuffer | Uint8Array, data: string): Promise<string> => {
  const sig = await hmac(key, data)
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const getSignatureKey = async (
  secret: string,
  date: string,
  region: string,
  service: string
): Promise<Uint8Array> => {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secret}`), date)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

// ---------------------------------------------------------------------------
// B2Storage
// ---------------------------------------------------------------------------

class B2Storage {
  private endpoint: string
  private bucket: string
  private accessKeyId: string
  private secretAccessKey: string
  private region: string

  constructor(options: {
    endpoint: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    region?: string
  }) {
    this.endpoint = options.endpoint.replace(/\/+$/, '')
    this.bucket = options.bucket
    this.accessKeyId = options.accessKeyId
    this.secretAccessKey = options.secretAccessKey
    this.region = options.region || 'us-west-004'
  }

  /** Build the S3 object URL for a key. */
  private objectUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
  }

  /** Sign a request with AWS Signature V4. */
  private async sign(
    method: string,
    url: string,
    headers: Headers,
    payloadHash?: string
  ): Promise<void> {
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)

    const urlObj = new URL(url)
    const canonicalUri = urlObj.pathname
    const canonicalQuery = urlObj.search.slice(1)

    const payloadHashFinal = payloadHash ?? (await sha256(''))

    headers.set('x-amz-date', amzDate)
    headers.set('x-amz-content-sha256', payloadHashFinal)
    headers.set('host', urlObj.host)

    const headerNames = [...headers.keys()].sort()
    const canonicalHeaders = headerNames
      .map((h) => `${h.toLowerCase()}:${(headers.get(h) || '').trim()}\n`)
      .join('')
    const signedHeaders = headerNames.map((h) => h.toLowerCase()).join(';')

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHashFinal
    ].join('\n')

    const scope = `${dateStamp}/${this.region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      await sha256(canonicalRequest)
    ].join('\n')

    const signingKey = await getSignatureKey(this.secretAccessKey, dateStamp, this.region, 's3')
    const signature = await hmacHex(signingKey, stringToSign)

    headers.set(
      'Authorization',
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    )
  }

  /** Parse S3 XML error response. */
  private async parseError(res: Response, action: string): Promise<Error> {
    let detail = ''
    try {
      const text = await res.text()
      const match = text.match(/<Message>([^<]*)<\/Message>/)
      detail = match ? match[1] : text.slice(0, 200)
    } catch {
      // ignore parse errors
    }
    return new Error(`B2 ${action} failed (${res.status}): ${detail}`)
  }

  /** Head an object. Returns null if not found. */
  async head(key: string): Promise<B2Object | null> {
    const url = this.objectUrl(key)
    const headers = new Headers()
    await this.sign('HEAD', url, headers)

    const res = await fetch(url, { method: 'HEAD', headers })
    if (res.status === 404) {
      return null
    }
    if (!res.ok) {
      throw await this.parseError(res, 'head')
    }

    return this.buildObject(key, res.headers)
  }

  /** Get an object. Returns null if not found. */
  async get(key: string): Promise<B2ObjectBody | null> {
    const url = this.objectUrl(key)
    const headers = new Headers()
    await this.sign('GET', url, headers)

    const res = await fetch(url, { method: 'GET', headers })
    if (res.status === 404) {
      return null
    }
    if (!res.ok) {
      throw await this.parseError(res, 'get')
    }

    const object = this.buildObject(key, res.headers)
    const body = res.body as ReadableStream

    return {
      ...object,
      body,
      bodyUsed: false,
      arrayBuffer: () => res.arrayBuffer(),
      text: () => res.text(),
      json: <T>() => res.json() as Promise<T>,
      blob: () => res.blob()
    }
  }

  /** Put an object. */
  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: B2PutOptions
  ): Promise<B2Object> {
    const url = this.objectUrl(key)
    const headers = new Headers()

    // Content-Type from httpMetadata or inferred from key extension.
    const contentType =
      options?.httpMetadata?.contentType ||
      this.inferContentType(key)
    if (contentType) {
      headers.set('Content-Type', contentType)
    }

    if (options?.httpMetadata?.contentDisposition) {
      headers.set('Content-Disposition', options.httpMetadata.contentDisposition)
    }
    if (options?.httpMetadata?.cacheControl) {
      headers.set('Cache-Control', options.httpMetadata.cacheControl)
    }

    // Custom metadata → x-amz-meta-* headers.
    if (options?.customMetadata) {
      for (const [k, v] of Object.entries(options.customMetadata)) {
        headers.set(`x-amz-meta-${k.toLowerCase()}`, v)
      }
    }

    // Convert value to a body + payload hash.
    let body: BodyInit | null = null
    let payloadHash: string

    if (value === null) {
      payloadHash = await sha256('')
    } else if (typeof value === 'string') {
      body = value
      payloadHash = await sha256(value)
    } else if (value instanceof ArrayBuffer) {
      body = value
      payloadHash = await sha256(value)
    } else if (ArrayBuffer.isView(value)) {
      const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
      body = buf
      payloadHash = await sha256(buf)
    } else if (value instanceof Blob) {
      const buf = await value.arrayBuffer()
      body = buf
      payloadHash = await sha256(buf)
    } else {
      // ReadableStream — hash by reading it fully (files are small enough).
      const reader = value.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      for (;;) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        chunks.push(chunk)
        total += chunk.length
      }
      const merged = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      const buf = merged.buffer as ArrayBuffer
      body = buf
      payloadHash = await sha256(buf)
    }

    await this.sign('PUT', url, headers, payloadHash)

    const res = await fetch(url, { method: 'PUT', headers, body })
    if (!res.ok) {
      throw await this.parseError(res, 'put')
    }

    // Parse ETag from response headers.
    const etag = res.headers.get('etag') || ''
    return this.buildObject(key, res.headers, etag)
  }

  /** Delete an object. */
  async delete(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key]
    for (const k of keys) {
      const url = this.objectUrl(k)
      const headers = new Headers()
      await this.sign('DELETE', url, headers)

      const res = await fetch(url, { method: 'DELETE', headers })
      if (!res.ok && res.status !== 404) {
        throw await this.parseError(res, 'delete')
      }
    }
  }

  /** Build an R2Object-compatible object from response headers. */
  private buildObject(key: string, headers: Headers, etagOverride?: string): B2Object {
    const etag = etagOverride || headers.get('etag') || ''
    const httpMetadata: B2HttpMetadata = {}
    const contentType = headers.get('content-type')
    const contentDisposition = headers.get('content-disposition')
    const cacheControl = headers.get('cache-control')
    if (contentType) httpMetadata.contentType = contentType
    if (contentDisposition) httpMetadata.contentDisposition = contentDisposition
    if (cacheControl) httpMetadata.cacheControl = cacheControl

    const customMetadata: Record<string, string> = {}
    headers.forEach((value, name) => {
      const lower = name.toLowerCase()
      if (lower.startsWith('x-amz-meta-')) {
        // Headers.set() lowercases header names, so uploaded metadata
        // keys are always lowercase (e.g. x-amz-meta-originalname).
        customMetadata[lower.slice('x-amz-meta-'.length)] = value
      }
    })

    const size = parseInt(headers.get('content-length') || '0', 10) || 0

    const result: B2Object = {
      key,
      size,
      etag,
      httpEtag: etag,
      uploaded: new Date(),
      httpMetadata,
      writeHttpMetadata: (h: Headers) => {
        if (contentType) h.set('Content-Type', contentType)
        if (contentDisposition) h.set('Content-Disposition', contentDisposition)
        if (cacheControl) h.set('Cache-Control', cacheControl)
      }
    }
    if (Object.keys(customMetadata).length > 0) {
      result.customMetadata = customMetadata
    }
    return result
  }

  /** Infer a content type from a file key extension. */
  private inferContentType(key: string): string | undefined {
    const ext = key.split('.').pop()?.toLowerCase() || ''
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      ico: 'image/x-icon',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      webm: 'video/webm',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      pdf: 'application/pdf',
      json: 'application/json',
      txt: 'text/plain',
      md: 'text/markdown',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      zip: 'application/zip',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
    return map[ext]
  }
}

export { B2Storage }
export type { B2Object, B2ObjectBody, B2HttpMetadata, B2PutOptions }
