/**
 * Storage provider resolution tests.
 *
 * These lock in the two properties that were previously broken:
 *   1. the active backend is chosen from `STORAGE_BACKEND`, not hardcoded to R2;
 *   2. an incomplete configuration fails closed with the missing variable names
 *      instead of silently falling back to the R2 binding.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  resolveStorage,
  getStorageInfo,
  testStorageConnection,
  STORAGE_HEALTH_CHECK_KEY
} from '../resolve-storage'
import { S3Storage } from '../s3-storage'
import type { StorageEnv, StorageInfo } from '../types'

/** Minimal stand-in for an R2 binding (only needs to be a bucket-like object). */
const r2Binding = {
  head: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

const fullB2Env: StorageEnv = {
  STORAGE_BACKEND: 'b2',
  B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
  B2_BUCKET: 'arwes-cms-media',
  B2_ACCESS_KEY_ID: 'key-id',
  B2_SECRET_ACCESS_KEY: 'secret'
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveStorage — defaults', () => {
  it('uses the R2 binding when STORAGE_BACKEND is unset', () => {
    const { bucket, info } = resolveStorage({ MEDIA_BUCKET: r2Binding })

    expect(info.provider).toBe('r2')
    expect(info.providerLabel).toBe('Cloudflare R2')
    expect(info.configured).toBe(true)
    expect(info.source).toBe('binding')
    expect(bucket).toBe(r2Binding)
  })

  it('accepts backend aliases for R2', () => {
    for (const alias of ['r2', 'cloudflare', 'cloudflare-r2', 'CF']) {
      const { info } = resolveStorage({ STORAGE_BACKEND: alias, MEDIA_BUCKET: r2Binding })
      expect(info.provider).toBe('r2')
      expect(info.configured).toBe(true)
    }
  })

  it('reports R2 as unconfigured when the binding is missing', () => {
    const { bucket, info } = resolveStorage({})

    expect(bucket).toBeNull()
    expect(info.provider).toBe('r2')
    expect(info.configured).toBe(false)
    expect(info.missingVars).toContain('MEDIA_BUCKET (R2 binding)')
    expect(info.error).toMatch(/MEDIA_BUCKET/)
  })
})

describe('resolveStorage — Backblaze B2', () => {
  it('builds an S3-compatible bucket from B2_* variables', () => {
    const { bucket, info } = resolveStorage(fullB2Env)

    expect(info.provider).toBe('b2')
    expect(info.providerLabel).toBe('Backblaze B2')
    expect(info.configured).toBe(true)
    expect(info.source).toBe('env')
    expect(info.bucketName).toBe('arwes-cms-media')
    expect(info.endpointHost).toBe('s3.us-west-004.backblazeb2.com')
    expect(info.region).toBe('us-west-004')
    expect(info.requestStyle).toBe('path')
    expect(bucket).toBeInstanceOf(S3Storage)
  })

  it('defaults the B2 region to us-west-004', () => {
    const { info } = resolveStorage(fullB2Env)
    expect(info.region).toBe('us-west-004')
  })

  it('fails closed instead of falling back to a bound R2 bucket', () => {
    const { bucket, info } = resolveStorage({
      STORAGE_BACKEND: 'b2',
      MEDIA_BUCKET: r2Binding,
      B2_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com'
    })

    expect(bucket).toBeNull()
    expect(info.configured).toBe(false)
    expect(info.provider).toBe('b2')
    expect(info.missingVars).toEqual(
      expect.arrayContaining(['B2_BUCKET', 'B2_ACCESS_KEY_ID', 'B2_SECRET_ACCESS_KEY'])
    )
    expect(info.error).toContain('B2_BUCKET')
  })

  it('warns when an R2 binding is bound but ignored', () => {
    const { info } = resolveStorage({ ...fullB2Env, MEDIA_BUCKET: r2Binding })
    expect(info.warnings.join(' ')).toMatch(/MEDIA_BUCKET/)
  })

  it('normalises an endpoint that is missing its scheme', () => {
    const { info } = resolveStorage({
      ...fullB2Env,
      B2_ENDPOINT: 's3.us-west-004.backblazeb2.com'
    })

    expect(info.configured).toBe(true)
    expect(info.endpointHost).toBe('s3.us-west-004.backblazeb2.com')
  })

  it('rejects an unparseable endpoint', () => {
    const { bucket, info } = resolveStorage({ ...fullB2Env, B2_ENDPOINT: 'http://' })

    expect(bucket).toBeNull()
    expect(info.configured).toBe(false)
    expect(info.error).toMatch(/not a valid URL/)
  })
})

describe('resolveStorage — generic S3-compatible', () => {
  it('derives the AWS endpoint from the region when none is given', () => {
    const { bucket, info } = resolveStorage({
      STORAGE_BACKEND: 's3',
      S3_BUCKET: 'my-bucket',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret'
    })

    expect(info.provider).toBe('s3')
    expect(info.configured).toBe(true)
    expect(info.region).toBe('us-east-1')
    expect(info.endpointHost).toBe('s3.us-east-1.amazonaws.com')
    expect(bucket).toBeInstanceOf(S3Storage)
  })

  it('honours S3_FORCE_PATH_STYLE=false for virtual-hosted addressing', () => {
    const { info } = resolveStorage({
      STORAGE_BACKEND: 's3',
      S3_ENDPOINT: 'https://minio.example.com',
      S3_BUCKET: 'media',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: 'false'
    })

    expect(info.requestStyle).toBe('virtual-host')
  })

  it('accepts the minio alias', () => {
    const { info } = resolveStorage({
      STORAGE_BACKEND: 'minio',
      S3_ENDPOINT: 'https://minio.example.com',
      S3_BUCKET: 'media',
      S3_ACCESS_KEY_ID: 'id',
      S3_SECRET_ACCESS_KEY: 'secret'
    })

    expect(info.provider).toBe('s3')
    expect(info.configured).toBe(true)
  })
})

describe('resolveStorage — unknown backend', () => {
  it('reports the supported values instead of guessing', () => {
    const { bucket, info } = resolveStorage({
      STORAGE_BACKEND: 'dropbox',
      MEDIA_BUCKET: r2Binding
    })

    expect(bucket).toBeNull()
    expect(info.configured).toBe(false)
    expect(info.requestedBackend).toBe('dropbox')
    expect(info.error).toContain('r2 (default), b2, s3')
  })
})

describe('getStorageInfo', () => {
  it('derives info from a raw Workers env', () => {
    const info = getStorageInfo({ MEDIA_BUCKET: r2Binding })
    expect(info.provider).toBe('r2')
    expect(info.configured).toBe(true)
  })

  it('reuses an injected STORAGE_INFO rather than re-resolving', () => {
    const injected: StorageInfo = {
      provider: 'b2',
      providerLabel: 'Backblaze B2',
      requestedBackend: 'b2',
      configured: true,
      bucketName: 'bucket',
      endpointHost: 'host',
      region: 'us-west-004',
      source: 'env',
      requestStyle: 'path',
      error: null,
      missingVars: [],
      warnings: []
    }

    const info = getStorageInfo({
      STORAGE_INFO: injected,
      MEDIA_BUCKET: { head: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() }
    })

    expect(info).toBe(injected)
  })
})

describe('testStorageConnection', () => {
  it('reports success when the bucket responds 404 for the probe key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await testStorageConnection(fullB2Env)

    expect(result.ok).toBe(true)
    expect(result.provider).toBe('b2')
    expect(result.bucketName).toBe('arwes-cms-media')
    expect(result.error).toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/arwes-cms-media/')
    expect(url).toContain(STORAGE_HEALTH_CHECK_KEY)
    expect(init.method).toBe('HEAD')
    // SigV4 must be applied — the probe has to be an authenticated request,
    // otherwise a 404 would not prove the credentials work.
    expect(String((init.headers as Headers).get('Authorization'))).toContain('AWS4-HMAC-SHA256')
  })

  it('reports failure with the provider message when credentials are rejected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<Error><Message>Invalid access key</Message></Error>', { status: 403 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await testStorageConnection(fullB2Env)

    expect(result.ok).toBe(false)
    expect(result.providerLabel).toBe('Backblaze B2')
    expect(result.error).toContain('Invalid access key')
  })

  it('reports failure without calling the network when unconfigured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await testStorageConnection({})

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/MEDIA_BUCKET/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
