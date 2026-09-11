/**
 * Backblaze B2 adapter — compatibility shim.
 *
 * B2 now runs on the generic S3-compatible adapter that ships with
 * `@flare-cms/core`, which supports R2, B2, AWS S3, MinIO and any other
 * S3-compatible endpoint. The backend is selected by `resolveStorage()` from
 * `STORAGE_BACKEND` + `B2_*` / `S3_*` variables.
 *
 * This module is kept only so the standalone dev scripts
 * (`scripts/test-b2-storage.ts`, `scripts/test-b2-signature.ts`) keep working.
 * New code should import `S3Storage` or `resolveStorage` from `@flare-cms/core`.
 */

export { S3Storage as B2Storage } from '@flare-cms/core'
export type { S3StorageOptions as B2StorageOptions } from '@flare-cms/core'
export type {
  StorageHttpMetadata as B2HttpMetadata,
  StoragePutOptions as B2PutOptions,
  StorageObject as B2Object,
  StorageObjectBody as B2ObjectBody
} from '@flare-cms/core'
