/**
 * Site provider metadata.
 *
 * The write path lives in `sites.ts` (SitesService) — this module is the single
 * description of what each provider *is* and what the CMS can actually do
 * against it. Both the service and the admin templates read from here so the
 * UI can never offer an action the provider cannot perform, and new providers
 * only need one entry.
 */

import type { SiteProvider } from './sites'

/** Fields the admin form may render; providers declare which apply to them. */
export type SiteProviderField =
  | 'project'
  | 'deployHook'
  | 'gitRepo'
  | 'gitBranch'
  | 'buildCommand'
  | 'deployCommand'
  | 'outputDir'
  | 'rootDir'
  | 'zoneId'
  | 'contentPrefix'

export interface SiteProviderCapabilities {
  /** The CMS can start a build at all. */
  triggerBuild: boolean
  /** A build can be started through the Builds API, without a Deploy Hook. */
  triggerBuildViaApi: boolean
  /** A build can be started by dispatching a GitHub Actions workflow. */
  triggerBuildViaGithubActions: boolean
  /** A build needs a stored Deploy Hook URL. */
  triggerBuildViaHook: boolean
  /** The CMS can attach/detach custom domains through the Cloudflare API. */
  manageDomains: boolean
  /** Build settings can be pushed to Cloudflare. */
  syncBuildConfig: boolean
  /** Build-time environment variables can be pushed to Cloudflare. */
  pushBuildEnv: boolean
  /** Build/deployment history can be read back. */
  listDeployments: boolean
}

export interface SiteProviderInfo {
  id: SiteProvider
  /** Label used in headings and select options. */
  label: string
  /** Label used in badges and dense tables. */
  shortLabel: string
  /** One-line description of the hosting model. */
  summary: string
  /** Tailwind classes for the provider badge. */
  badgeClass: string
  /** Provider-specific fields the admin form shows for this provider. */
  fields: SiteProviderField[]
  can: SiteProviderCapabilities
  /** What an operator must create in Cloudflare before the CMS can drive it. */
  setup: string
}

export const SITE_PROVIDERS: SiteProviderInfo[] = [
  {
    id: 'cloudflare-worker',
    label: 'Cloudflare Worker + static assets',
    shortLabel: 'Worker',
    summary:
      'One Worker serves the built assets and can answer on many custom domains. This is the only provider where the CMS can attach several domains to the same build.',
    badgeClass:
      'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20',
    fields: [
      'project',
      'gitRepo',
      'gitBranch',
      'buildCommand',
      'deployCommand',
      'rootDir',
      'outputDir',
      'zoneId',
      'contentPrefix',
      'deployHook'
    ],
    can: {
      triggerBuild: true,
      triggerBuildViaApi: true,
      triggerBuildViaGithubActions: true,
      triggerBuildViaHook: true,
      manageDomains: true,
      syncBuildConfig: true,
      pushBuildEnv: true,
      listDeployments: true
    },
    setup:
      'Connect the Worker to a Git repository in Cloudflare (Worker → Settings → Builds) so a trigger exists, and the CMS will fill that trigger’s build command, deploy command, root directory and build environment. No Git? Cloudflare cannot build the site inside a Worker (Workers Builds is Git-only and a Worker has no build toolchain), so build locally instead and deploy the output with the direct-upload API — `wrangler deploy` already does that. The CMS still owns the site’s domains and content either way.'
  },
  {
    id: 'cloudflare-pages',
    label: 'Cloudflare Pages project',
    shortLabel: 'Pages',
    summary:
      'A Pages project builds and hosts the site. Domains are bound per project, so one project is one site.',
    badgeClass:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    fields: [
      'project',
      'deployHook',
      'gitRepo',
      'gitBranch',
      'buildCommand',
      'outputDir',
      'rootDir',
      'contentPrefix'
    ],
    can: {
      triggerBuild: true,
      triggerBuildViaApi: false,
      triggerBuildViaGithubActions: true,
      triggerBuildViaHook: true,
      manageDomains: true,
      syncBuildConfig: true,
      pushBuildEnv: false,
      listDeployments: true
    },
    setup:
      'Create the Pages project (Git-connected or direct upload) and a Deploy Hook under Pages project → Settings → Builds & deployments. Build environment variables for Pages are set in the project’s own settings, not by the CMS.'
  },
  {
    id: 'external',
    label: 'External — record only',
    shortLabel: 'External',
    summary:
      'The CMS tracks the site, its content and its domain names, but never talks to a hosting API. Use it for anything the CMS does not deploy.',
    badgeClass:
      'bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-white/5 dark:text-zinc-300 dark:ring-white/10',
    fields: ['gitRepo', 'gitBranch', 'contentPrefix'],
    can: {
      triggerBuild: false,
      triggerBuildViaApi: false,
      triggerBuildViaGithubActions: false,
      triggerBuildViaHook: false,
      manageDomains: false,
      syncBuildConfig: false,
      pushBuildEnv: false,
      listDeployments: false
    },
    setup:
      'Nothing to prepare. Content isolation still applies, so the site can own content that no other site sees.'
  }
]

const BY_ID = new Map(SITE_PROVIDERS.map((provider) => [provider.id, provider]))

/** Provider metadata, never throws: unknown ids fall back to `external`. */
export const getSiteProvider = (id: SiteProvider | string): SiteProviderInfo =>
  BY_ID.get(id as SiteProvider) ?? BY_ID.get('external')!

/** Human label for a provider id, for messages and templates. */
export const providerLabel = (id: SiteProvider | string): string =>
  getSiteProvider(id).label

/** Dense label for badges. */
export const providerShortLabel = (id: SiteProvider | string): string =>
  getSiteProvider(id).shortLabel

/** Iteration order used when grouping sites by type in the admin UI. */
export const SITE_PROVIDER_ORDER: SiteProvider[] = SITE_PROVIDERS.map(
  (provider) => provider.id
)
