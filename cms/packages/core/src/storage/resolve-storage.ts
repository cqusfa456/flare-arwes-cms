/**
 * Storage backend resolution.
 *
 * `resolveStorage(env)` is the single decision point for "which bucket does the
 * CMS read and write?". It is driven purely by environment configuration
 * (`STORAGE_BACKEND` + provider variables), never by database settings, so a
 * deployment's storage backend is reproducible from its secrets alone.
 *
 * Two behaviours matter and are deliberate:
 *
 * 1. **No silent fallback.** If a non-default backend is requested but its
 *    variables are missing, resolution returns `bucket: null` plus an
 *    actionable error instead of quietly serving R2. Silent fallback is what
 *    made "it is still R2" impossible to diagnose.
 * 2. **No secrets in the result.** {@link StorageInfo} is rendered in the admin
 *    UI and returned by the system API, so it exposes only host/bucket/region.
 */

import { S3Storage } from './s3-storage'
import {
  BACKEND_ALIASES,
  SUPPORTED_BACKEND_VALUES,
  getProviderLabel
} from './providers'
import type {
  ResolvedStorage,
  StorageBucket,
  StorageEnv,
  StorageInfo,
  StorageProviderId,
  StorageTestResult
} from './types'

/** Key polled by the connectivity self-check. Never written. */
export const STORAGE_HEALTH_CHECK_KEY = '__health_check__'

/** Read a trimmed string variable from the Workers env. */
const readVar = (env: StorageEnv, key: string): string => {
  const value = env[key]
  return typeof value === 'string' ? value.trim() : ''
}

/** A value usable as a bucket. */
const isBucketLike = (value: unknown): boolean =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as StorageBucket).head === 'function' &&
  typeof (value as StorageBucket).get === 'function' &&
  typeof (value as StorageBucket).put === 'function'

/** Type guard for an already-resolved {@link StorageInfo}. */
const isStorageInfo = (value: unknown): value is StorageInfo => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as StorageInfo
  return (
    (candidate.provider === 'r2' ||
      candidate.provider === 'b2' ||
      candidate.provider === 's3') &&
    typeof candidate.configured === 'boolean'
  )
}

/**
 * Normalise a configured endpoint into a scheme-qualified base URL plus host.
 * A missing scheme is filled in with `https://`, and a path prefix is kept so
 * gateways such as `https://host/s3` work.
 */
const normalizeEndpoint = (
  raw: string
): { baseUrl: string; host: string } | { invalid: string } => {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (!url.host) return { invalid: raw }
    return {
      baseUrl: `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`,
      host: url.host
    }
  } catch {
    return { invalid: raw }
  }
}

/** Build the blocked-result info object. */
const unconfigured = (
  provider: StorageProviderId,
  requestedBackend: string | null,
  error: string,
  missingVars: string[],
  warnings: string[] = []
): StorageInfo => ({
  provider,
  providerLabel: getProviderLabel(provider),
  requestedBackend,
  configured: false,
  bucketName: null,
  endpointHost: null,
  region: null,
  source: provider === 'r2' ? 'binding' : 'env',
  requestStyle: null,
  error,
  missingVars,
  warnings
})

/**
 * Resolve the active storage backend from environment configuration.
 *
 * Never throws — misconfiguration is reported through `info.error`.
 */
export function resolveStorage(env: StorageEnv = {}): ResolvedStorage {
  // Re-entrancy: the Worker entry point already resolved this env and injected
  // both the bucket and its description. Trust it rather than rebuilding.
  if (isStorageInfo(env.STORAGE_INFO) && isBucketLike(env.MEDIA_BUCKET)) {
    return {
      bucket: env.MEDIA_BUCKET as StorageBucket,
      info: env.STORAGE_INFO
    }
  }

  const requestedBackend = readVar(env, 'STORAGE_BACKEND')
  const provider = BACKEND_ALIASES[requestedBackend.toLowerCase()]
  const warnings: string[] = []

  if (!provider) {
    return {
      bucket: null,
      info: unconfigured(
        'r2',
        requestedBackend,
        `Unknown STORAGE_BACKEND "${requestedBackend}". Supported values: ${SUPPORTED_BACKEND_VALUES}.`,
        []
      )
    }
  }

  if (provider === 'r2') {
    const binding = env.MEDIA_BUCKET

    if (!binding || typeof binding !== 'object') {
      return {
        bucket: null,
        info: unconfigured(
          'r2',
          requestedBackend || null,
          'STORAGE_BACKEND=r2 requires the MEDIA_BUCKET R2 binding. Add an [[r2_buckets]] block to wrangler.toml, or set STORAGE_BACKEND=b2/s3 to use an S3-compatible backend.',
          ['MEDIA_BUCKET (R2 binding)']
        )
      }
    }

    const bucketName =
      readVar(env, 'R2_BUCKET_NAME') || readVar(env, 'BUCKET_NAME') || null

    return {
      bucket: binding as StorageBucket,
      info: {
        provider: 'r2',
        providerLabel: getProviderLabel('r2'),
        requestedBackend: requestedBackend || null,
        configured: true,
        bucketName,
        endpointHost: null,
        region: readVar(env, 'R2_REGION') || null,
        source: 'binding',
        requestStyle: null,
        error: null,
        missingVars: [],
        warnings
      }
    }
  }

  // B2 and generic S3 both ride the S3-compatible adapter; only the variable
  // names, defaults and endpoint derivation differ.
  const isB2 = provider === 'b2'
  const prefix = isB2 ? 'B2' : 'S3'

  // Any non-R2 provider ignores the R2 binding, so flag it — a leftover
  // [[r2_buckets]] block is the classic reason a deployment "still uses R2".
  if (isBucketLike(env.MEDIA_BUCKET)) {
    warnings.push(
      'An R2 binding (MEDIA_BUCKET) is bound to this Worker but is being ignored because STORAGE_BACKEND selects a different backend. Remove [[r2_buckets]] to avoid confusion.'
    )
  }

  const requiredKeys = [`${prefix}_BUCKET`, `${prefix}_ACCESS_KEY_ID`, `${prefix}_SECRET_ACCESS_KEY`]
  const endpointKey = `${prefix}_ENDPOINT`
  const regionKey = `${prefix}_REGION`

  const bucketName = readVar(env, `${prefix}_BUCKET`)
  const accessKeyId = readVar(env, `${prefix}_ACCESS_KEY_ID`)
  const secretAccessKey = readVar(env, `${prefix}_SECRET_ACCESS_KEY`)

  const region =
    readVar(env, regionKey) ||
    (isB2 ? 'us-west-004' : readVar(env, 'AWS_REGION') || 'us-east-1')

  // The generic S3 provider can derive the AWS endpoint from the region.
  const rawEndpoint =
    readVar(env, endpointKey) ||
    (isB2 ? '' : region ? `https://s3.${region}.amazonaws.com` : '')

  const missingVars = requiredKeys.filter((key) => !readVar(env, key))
  if (!rawEndpoint) {
    missingVars.push(`${endpointKey} (or ${regionKey}/AWS_REGION)`)
  }

  if (missingVars.length > 0) {
    return {
      bucket: null,
      info: unconfigured(
        provider,
        requestedBackend,
        `STORAGE_BACKEND=${requestedBackend} is missing required configuration: ${missingVars.join(', ')}.`,
        missingVars,
        warnings
      )
    }
  }

  const endpoint = normalizeEndpoint(rawEndpoint)
  if ('invalid' in endpoint) {
    return {
      bucket: null,
      info: unconfigured(
        provider,
        requestedBackend,
        `${endpointKey} is not a valid URL: "${endpoint.invalid}".`,
        [endpointKey],
        warnings
      )
    }
  }

  // B2 and MinIO require path-style addressing. AWS S3 accepts either, so it
  // stays configurable via S3_FORCE_PATH_STYLE.
  const forcePathStyle = isB2
    ? true
    : readVar(env, 'S3_FORCE_PATH_STYLE').toLowerCase() !== 'false'

  const bucket = new S3Storage({
    endpoint: endpoint.baseUrl,
    bucket: bucketName,
    accessKeyId,
    secretAccessKey,
    region,
    forcePathStyle,
    providerLabel: getProviderLabel(provider)
  })

  return {
    bucket,
    info: {
      provider,
      providerLabel: getProviderLabel(provider),
      requestedBackend,
      configured: true,
      bucketName,
      endpointHost: endpoint.host,
      region,
      source: 'env',
      requestStyle: forcePathStyle ? 'path' : 'virtual-host',
      error: null,
      missingVars: [],
      warnings
    }
  }
}

/**
 * Describe the active storage backend without building a client when possible.
 *
 * Route handlers use this instead of inspecting `MEDIA_BUCKET` directly, so the
 * UI and the system API always agree with the runtime. Accepts any Workers env
 * shape (bindings interfaces do not carry an index signature).
 */
export function getStorageInfo(env: unknown = {}): StorageInfo {
  return resolveStorage(env as StorageEnv).info
}

/**
 * Run an authenticated `head` against the active bucket.
 *
 * A 404/`null` result counts as success — it proves the endpoint, bucket and
 * credentials all work. Only a thrown error (403, DNS, network, bad endpoint)
 * is reported as a failure.
 */
export async function testStorageConnection(env: unknown = {}): Promise<StorageTestResult> {
  const { bucket, info } = resolveStorage(env as StorageEnv)
  const startedAt = Date.now()

  const base = {
    provider: info.provider,
    providerLabel: info.providerLabel,
    bucketName: info.bucketName
  }

  if (!info.configured || !bucket || typeof bucket.head !== 'function') {
    return {
      ...base,
      ok: false,
      latencyMs: 0,
      error: info.error || 'Storage backend is not configured.'
    }
  }

  try {
    await bucket.head(STORAGE_HEALTH_CHECK_KEY)
    return { ...base, ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      ...base,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
