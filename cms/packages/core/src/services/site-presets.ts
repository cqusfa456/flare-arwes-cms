/**
 * Arwes site presets.
 *
 * Registering a site by hand means knowing the monorepo's build contract: which
 * workspace builds first, where the static output lands, and which binary
 * deploys it. These presets encode that contract once, so "add a site" is a
 * click plus a slug instead of a documentation exercise.
 *
 * `{{slug}}` in a command is substituted with the (normalised) site slug when the
 * site is created, which is what lets a preset describe an Astro app generically:
 * a site with the slug `play` becomes `sh ./apps/play/scripts/build-worker.sh`.
 */

import type { SiteDeployMode, SiteInput, SiteProvider } from './sites'

export interface SitePreset {
  id: string
  name: string
  /** Suggested slug; empty for templates the operator must name. */
  slug: string
  provider: SiteProvider
  /** How the build runs: null = the provider default. */
  deployMode?: SiteDeployMode
  /** Worker name or Pages project name. */
  cfProjectName: string
  description: string
  gitRepo: string
  gitBranch: string
  buildCommand: string
  deployCommand: string
  rootDir: string
  outputDir: string
  /** App directory inside the repository, for documentation and hints. */
  app: string
  /**
   * True for a generic starting point: offered in the "new site" form but never
   * created by "import presets", because it does not describe a real target.
   */
  template?: boolean
  /** Extra build-time environment variables (non-secret). */
  buildEnv?: Record<string, string>
  /** What the operator still has to do in Cloudflare. */
  notes: string[]
}

export const ARWES_SITE_PRESETS: SitePreset[] = [
  {
    id: 'arwes-docs',
    name: 'Arwes Docs',
    slug: 'arwes-docs',
    provider: 'cloudflare-worker',
    deployMode: 'github-actions',
    cfProjectName: 'arwes-docs-worker',
    description:
      'Arwes documentation site. Astro builds into apps/docs/build and the Worker serves it from static assets, so one build can answer on several custom domains.',
    gitRepo: 'cqusfa456/flare-arwes-cms',
    gitBranch: 'main',
    buildCommand: 'sh ./apps/docs/scripts/build-worker.sh',
    deployCommand:
      'cd apps/docs && ../../cms/packages/cms/node_modules/.bin/wrangler deploy',
    rootDir: '/',
    outputDir: 'apps/docs/build',
    app: 'apps/docs',
    notes: [
      'Builds and uploads through GitHub Actions (Admin → Sites → Deploy via GitHub Actions): the workflow runs build_command then deploy_command and uploads directly, so Cloudflare needs no Git connection and no Deploy Hook.',
      'Bind a custom domain (for example docs.<your-domain>) from this page; *.workers.dev works too but is blocked on some networks.'
    ]
  },
  {
    id: 'arwes-docs-pages',
    name: 'Arwes Docs (Cloudflare Pages)',
    slug: 'arwes-docs-pages',
    provider: 'cloudflare-pages',
    deployMode: 'github-actions',
    cfProjectName: 'arwes-docs',
    description:
      'The same docs build, uploaded to a Cloudflare Pages project instead of a Worker. Pages projects take custom domains and subdomains directly, and Direct Upload means Cloudflare still needs no Git connection.',
    gitRepo: 'cqusfa456/flare-arwes-cms',
    gitBranch: 'main',
    buildCommand: 'sh ./apps/docs/scripts/build-worker.sh',
    deployCommand:
      'cms/packages/cms/node_modules/.bin/wrangler pages deploy apps/docs/build --project-name=arwes-docs --branch=main',
    rootDir: '/',
    outputDir: 'apps/docs/build',
    app: 'apps/docs',
    notes: [
      'Create the Pages project first (or reuse the existing arwes-docs one); Direct Upload projects cannot be rebuilt by a Deploy Hook, which is exactly why this preset dispatches GitHub Actions instead.',
      'The Pages project must expose the right production branch name (--branch=main above) for its production deployment to advance.',
      'Bind domains from this page: Pages custom domains do not need a zone id, unlike Worker custom domains.'
    ]
  },
  {
    id: 'arwes-astro-worker',
    name: 'Arwes Astro site (Worker + assets)',
    slug: '',
    provider: 'cloudflare-worker',
    cfProjectName: 'arwes-{{slug}}-worker',
    description:
      'Template for another Astro app in this monorepo: builds the app and serves its static output from a Worker, with per-site content pulled from the CMS at build time.',
    gitRepo: 'cqusfa456/flare-arwes-cms',
    gitBranch: 'main',
    buildCommand: 'sh ./apps/{{slug}}/scripts/build-worker.sh',
    deployCommand:
      'cd apps/{{slug}} && ../../cms/packages/cms/node_modules/.bin/wrangler deploy',
    rootDir: '/',
    outputDir: 'apps/{{slug}}/build',
    app: 'apps/{{slug}}',
    template: true,
    deployMode: 'github-actions',
    notes: [
      'The app needs its own wrangler configuration with an assets binding, plus scripts/build-worker.sh (copy apps/docs/scripts/build-worker.sh).',
      'Name the site after the app directory: slug "play" resolves {{slug}} to apps/play and arwes-play-worker.'
    ]
  }
]

const BY_ID = new Map(ARWES_SITE_PRESETS.map((preset) => [preset.id, preset]))

export const getSitePreset = (id: string): SitePreset | undefined => BY_ID.get(id)

/** Presets that describe a real deployment (i.e. what "import presets" creates). */
export const importablePresets = (): SitePreset[] =>
  ARWES_SITE_PRESETS.filter((preset) => !preset.template)

/**
 * Substitute `{{slug}}` and `{{app}}` placeholders.
 *
 * The slug is normalised by the caller (SitesService.create does it again), so a
 * value like `My App` becomes `my-app` and yields `apps/my-app/build`.
 */
export const substitutePreset = (value: string, slug: string): string =>
  value.replace(/\{\{\s*slug\s*\}\}/g, slug).replace(/\{\{\s*app\s*\}\}/g, slug)

/** Build a `SiteInput` from a preset, substituting placeholders with `slug`. */
export const presetToSiteInput = (preset: SitePreset, slug: string): SiteInput => ({
  slug: slug || preset.slug,
  name: preset.name,
  description: preset.description,
  provider: preset.provider,
  ...(preset.deployMode ? { deployMode: preset.deployMode } : {}),
  cfProjectName: substitutePreset(preset.cfProjectName, slug),
  gitRepo: preset.gitRepo,
  gitBranch: preset.gitBranch,
  buildCommand: substitutePreset(preset.buildCommand, slug),
  deployCommand: substitutePreset(preset.deployCommand, slug),
  rootDir: preset.rootDir,
  outputDir: substitutePreset(preset.outputDir, slug),
  buildEnv: preset.buildEnv
    ? Object.fromEntries(
        Object.entries(preset.buildEnv).map(([key, value]) => [key, { value, secret: false }])
      )
    : null
})
