/**
 * Storage provider abstractions for Flare CMS.
 *
 * The CMS talks to media storage through the minimal {@link StorageBucket}
 * surface (head/get/put/delete). Cloudflare's native `R2Bucket` satisfies it
 * structurally, and so do the S3-compatible adapters in this folder — which is
 * what makes multi-provider support possible without touching route handlers.
 *
 * Which provider is active is decided **only** by environment configuration
 * (see `resolve-storage.ts`). Admin UI is read-only with respect to the
 * provider: it reports what the runtime resolved and can run a self-check.
 */

/** Supported storage backends. */
export type StorageProviderId = 'r2' | 'b2' | 's3'

/** How the active backend was wired up. */
export type StorageBindingSource = 'binding' | 'env'

export interface StorageHttpMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}

export interface StoragePutOptions {
  httpMetadata?: StorageHttpMetadata
  customMetadata?: Record<string, string>
}

export interface StorageObject {
  key: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  httpMetadata?: StorageHttpMetadata
  customMetadata?: Record<string, string>
  writeHttpMetadata: (headers: Headers) => void
}

export interface StorageObjectBody extends StorageObject {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
  json: <T>() => Promise<T>
  blob: () => Promise<Blob>
}

/**
 * Minimal bucket surface used by the CMS. Structurally satisfied by
 * Cloudflare `R2Bucket` and by `S3Storage`.
 */
export interface StorageBucket {
  head: (key: string) => Promise<StorageObject | null>
  get: (key: string) => Promise<StorageObjectBody | null>
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: StoragePutOptions
  ) => Promise<StorageObject>
  delete: (key: string | string[]) => Promise<void>
}

/**
 * Runtime description of the active storage backend.
 *
 * Deliberately contains **no credentials** — it is rendered in the admin UI and
 * returned by the system API.
 */
export interface StorageInfo {
  /** Resolved provider id. */
  provider: StorageProviderId
  /** Human readable provider name, e.g. "Backblaze B2". */
  providerLabel: string
  /** Raw `STORAGE_BACKEND` value as configured (empty when unset). */
  requestedBackend: string | null
  /** True when a usable bucket was resolved. */
  configured: boolean
  /** Bucket name, when it can be determined. */
  bucketName: string | null
  /** Endpoint host only (no scheme, no credentials), for S3-compatible backends. */
  endpointHost: string | null
  /** Region, when applicable. */
  region: string | null
  /** Whether the backend came from a Workers binding or from environment vars. */
  source: StorageBindingSource
  /** URL style used by S3-compatible adapters. */
  requestStyle: 'path' | 'virtual-host' | null
  /** Blocking misconfiguration message, if any. */
  error: string | null
  /** Environment variables/keys that must be provided but are missing. */
  missingVars: string[]
  /** Non-blocking notes, e.g. an ignored R2 binding. */
  warnings: string[]
}

/** Catalog entry describing a provider the CMS can run on. */
export interface StorageProviderOption {
  id: StorageProviderId
  label: string
  description: string
  /** Environment variables that must be present to activate this provider. */
  requiredVars: string[]
  /** Optional environment variables. */
  optionalVars: string[]
  /** How the provider is bound. */
  wiring: 'workers-binding' | 'env-vars'
  docsUrl: string
}

/** Result of a storage connectivity self-check. */
export interface StorageTestResult {
  ok: boolean
  provider: StorageProviderId
  providerLabel: string
  bucketName: string | null
  latencyMs: number
  /** Present when the check failed. */
  error?: string
}

/** The subset of the Workers env this module cares about. */
export interface StorageEnv {
  STORAGE_BACKEND?: string
  MEDIA_BUCKET?: unknown
  BUCKET_NAME?: string
  // Cloudflare R2 (binding) metadata
  R2_BUCKET_NAME?: string
  R2_REGION?: string
  // Backblaze B2
  B2_ENDPOINT?: string
  B2_BUCKET?: string
  B2_ACCESS_KEY_ID?: string
  B2_SECRET_ACCESS_KEY?: string
  B2_REGION?: string
  // Generic S3-compatible (AWS S3, MinIO, R2 S3 API, ...)
  S3_ENDPOINT?: string
  S3_BUCKET?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_REGION?: string
  S3_FORCE_PATH_STYLE?: string
  AWS_REGION?: string
  // Populated by resolveStorage() on the env handed to the app
  STORAGE_INFO?: StorageInfo
  [key: string]: unknown
}

/** Outcome of {@link resolveStorage}. */
export interface ResolvedStorage {
  /** Usable bucket, or `null` when misconfigured. */
  bucket: StorageBucket | null
  /** Runtime description of the backend. Always present. */
  info: StorageInfo
}
