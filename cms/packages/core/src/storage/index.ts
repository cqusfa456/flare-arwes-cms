/**
 * Storage module — provider resolution and S3-compatible adapters.
 *
 * @example Worker entry point
 * ```ts
 * import { resolveStorage } from '@sci-fi-cms/core'
 *
 * const { bucket, info } = resolveStorage(env)
 * app.fetch(request, { ...env, MEDIA_BUCKET: bucket, STORAGE_INFO: info }, ctx)
 * ```
 */

export { S3Storage } from './s3-storage'
export type { S3StorageOptions } from './s3-storage'

export {
  STORAGE_PROVIDERS,
  BACKEND_ALIASES,
  SUPPORTED_BACKEND_VALUES,
  getProviderOption,
  getProviderLabel
} from './providers'

export {
  resolveStorage,
  getStorageInfo,
  testStorageConnection,
  STORAGE_HEALTH_CHECK_KEY
} from './resolve-storage'

export type {
  StorageProviderId,
  StorageBindingSource,
  StorageProviderOption,
  StorageHttpMetadata,
  StoragePutOptions,
  StorageObject,
  StorageObjectBody,
  StorageBucket,
  StorageInfo,
  StorageTestResult,
  StorageEnv,
  ResolvedStorage
} from './types'
