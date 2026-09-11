/**
 * Storage provider catalog.
 *
 * Single source of truth for which backends the CMS supports, how each one is
 * configured, and what the admin UI should display. Adding a provider means
 * adding an entry here plus a case in `resolveStorage()`.
 */

import type { StorageProviderId, StorageProviderOption } from './types'

/** Cloudflare R2 — the default backend, referenced as a safe fallback entry. */
const R2_PROVIDER: StorageProviderOption = {
  id: 'r2',
  label: 'Cloudflare R2',
  description:
    'Default backend. Media lives in an R2 bucket bound to the Worker, so reads and writes never leave Cloudflare.',
  requiredVars: ['MEDIA_BUCKET'],
  optionalVars: ['BUCKET_NAME'],
  wiring: 'workers-binding',
  docsUrl: 'https://developers.cloudflare.com/r2/'
}

const B2_PROVIDER: StorageProviderOption = {
  id: 'b2',
  label: 'Backblaze B2',
  description:
    'Private B2 bucket reached over the S3-compatible API with SigV4 signing. Cheaper egress; the R2 binding can be removed.',
  requiredVars: [
    'B2_ENDPOINT',
    'B2_BUCKET',
    'B2_ACCESS_KEY_ID',
    'B2_SECRET_ACCESS_KEY'
  ],
  optionalVars: ['B2_REGION'],
  wiring: 'env-vars',
  docsUrl: 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api'
}

const S3_PROVIDER: StorageProviderOption = {
  id: 's3',
  label: 'S3-compatible',
  description:
    'Any S3-compatible object store: Amazon S3, MinIO, Wasabi, or the R2 S3 API. Endpoint is derived from the region when omitted.',
  requiredVars: ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
  optionalVars: ['S3_ENDPOINT', 'S3_REGION', 'S3_FORCE_PATH_STYLE', 'AWS_REGION'],
  wiring: 'env-vars',
  docsUrl: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/'
}

/** Backends the CMS can run on, in the order the admin UI should show them. */
export const STORAGE_PROVIDERS: StorageProviderOption[] = [
  R2_PROVIDER,
  B2_PROVIDER,
  S3_PROVIDER
]

/**
 * Accepted `STORAGE_BACKEND` spellings → provider id.
 * An empty/unset value means the default backend (R2).
 */
export const BACKEND_ALIASES: Record<string, StorageProviderId> = {
  '': 'r2',
  r2: 'r2',
  cloudflare: 'r2',
  'cloudflare-r2': 'r2',
  cf: 'r2',
  b2: 'b2',
  backblaze: 'b2',
  'backblaze-b2': 'b2',
  s3: 's3',
  aws: 's3',
  'aws-s3': 's3',
  's3-compatible': 's3',
  minio: 's3',
  wasabi: 's3'
}

/** Values advertised in error messages and the admin UI. */
export const SUPPORTED_BACKEND_VALUES = 'r2 (default), b2, s3'

/** Look up a catalog entry by provider id. */
export function getProviderOption(id: StorageProviderId): StorageProviderOption {
  return STORAGE_PROVIDERS.find((provider) => provider.id === id) ?? R2_PROVIDER
}

/** Human readable provider name, e.g. `Backblaze B2`. */
export function getProviderLabel(id: StorageProviderId): string {
  return getProviderOption(id).label
}
