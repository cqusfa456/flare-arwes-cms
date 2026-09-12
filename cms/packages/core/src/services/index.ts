/**
 * Services Module Exports
 *
 * Core business logic services for Sci-Fi CMS
 */

// Collection Management
export {
  loadCollectionConfigs,
  loadCollectionConfig,
  getAvailableCollectionNames,
  validateCollectionConfig,
  registerCollections,
} from './collection-loader'

export {
  syncCollections,
  syncCollection,
  isCollectionManaged,
  getManagedCollections,
  cleanupRemovedCollections,
  fullCollectionSync,
} from './collection-sync'

// Database Migrations
export { MigrationService } from './migrations'
export type { Migration, MigrationStatus } from './migrations'

// Logging
export { Logger, getLogger, initLogger } from './logger'
export type { LogLevel, LogCategory, LogEntry, LogFilter } from './logger'

// Plugin Services
export { PluginService } from './plugin-service'
export { PluginBootstrapService } from './plugin-bootstrap'
export type { CorePlugin } from './plugin-bootstrap'

// Cache Service
export { CacheService, getCacheService, CACHE_CONFIGS, setGlobalKVNamespace } from './cache'
export type { CacheConfig } from './cache'

// Settings Service
export { SettingsService } from './settings'
export type { Setting, GeneralSettings } from './settings'

// Sites Service — the CMS as the control plane for every website
// (registry, Cloudflare builds, domain bindings, build environment, content ownership)
export {
  SitesService,
  SitesConfigError,
  normalizeSiteSlug,
  normalizeHostname,
  buildSiteEnvironment,
} from './sites'
export type {
  Site,
  SiteInput,
  SiteDomain,
  SiteDomainStatus,
  SiteProvider,
  SiteDeploymentInfo,
  BuildTriggerResult,
  CloudflareCredentialStatus,
  SiteBuildEnvVar,
  SyncBuildConfigResult,
  SitePresetImportResult,
} from './sites'

// Provider metadata — labels, applicable fields and the capability matrix the
// Admin → Sites pages group and gate on.
export {
  SITE_PROVIDERS,
  SITE_PROVIDER_ORDER,
  getSiteProvider,
  providerLabel,
  providerShortLabel,
} from './site-providers'
export type { SiteProviderInfo, SiteProviderCapabilities, SiteProviderField } from './site-providers'

// Arwes site presets — the monorepo build contract, applied with one click.
export {
  ARWES_SITE_PRESETS,
  getSitePreset,
  importablePresets,
  presetToSiteInput,
  substitutePreset,
} from './site-presets'
export type { SitePreset } from './site-presets'

// Content site scoping — per-site content isolation for readers
export {
  resolveContentSiteScope,
  contentSiteScopeFragment,
  applyContentSiteScope,
  describeSiteScope,
  resolveSiteId,
  hasActiveSites,
} from './content-site-scope'
export type {
  ContentSiteScope,
  SiteScopeMode,
  SiteScopeSource,
  ResolveSiteScopeInput,
  ResolvedSiteId,
} from './content-site-scope'

// Telemetry Service
export {
  TelemetryService,
  getTelemetryService,
  initTelemetry,
  createInstallationIdentity
} from './telemetry-service'

// Content State Machine
export {
  VALID_TRANSITIONS,
  validateStatusTransition,
  isSlugLocked,
  getUnpublishUpdates,
} from './content-state-machine'

// RBAC Service — Collection-Level Permissions
export {
  checkCollectionPermission,
  getCollectionPermissions,
  grantCollectionPermission,
  revokeCollectionPermission,
  isAuthorAllowedToEdit,
} from './rbac'
export type { CollectionAction, CollectionRole } from './rbac'

// API Token Service
export {
  hashToken,
  createApiToken,
  validateApiToken,
  revokeApiToken,
  listApiTokens,
} from './api-tokens'

// Scheduler Service
export { SchedulerService } from '../plugins/core-plugins/workflow-plugin/services/scheduler'
export type { ScheduledContent } from '../plugins/core-plugins/workflow-plugin/services/scheduler'

export type {
  ApiTokenRecord,
  ApiTokenSafe,
  CreateApiTokenParams,
  CreateApiTokenResult,
  ValidateApiTokenResult,
} from './api-tokens'

// Revision Service — Content Staging Layer
export {
  createPendingRevision,
  getPendingCount,
  getPendingRevisions,
  approveRevision,
  approveAllRevisions,
  rejectRevision,
  computeDiff,
  hasPendingRevision,
  getLatestPendingRevision,
} from './revisions'
export type { RevisionStatus, PendingRevision, RevisionDiff } from './revisions'

// Audit Trail Service — Workflow History Logging
export {
  computeFieldDiff,
  logStatusChange,
  logContentEdit,
} from './audit-trail'

// Audit Log Service — Comprehensive admin action logging
export {
  logAudit,
  queryAuditLog,
  getResourceHistory,
  getClientIP,
} from './audit-log'
export type { AuditEntry, AuditLogRow, AuditFilter } from './audit-log'

// Schema Migration Service — Schema evolution tracking
export { SchemaMigrationService } from './schema-migration'
export type { SchemaChange, SchemaMigration } from './schema-migration'

// Webhook Delivery Service — Outbound HTTP webhooks on publish/unpublish events
export {
  deliverWebhooks,
} from './webhook-delivery'
export type { WebhookPayload } from './webhook-delivery'
