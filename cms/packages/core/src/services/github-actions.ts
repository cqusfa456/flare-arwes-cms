/**
 * GitHub Actions dispatch — how the CMS starts a build Cloudflare cannot run.
 *
 * Workers Builds (Cloudflare's own CI) is a Git integration, and a Worker has no
 * build toolchain, so a site that refuses a Cloudflare-side Git connection still
 * needs somewhere to run `astro build`. The CMS dispatches
 * `.github/workflows/deploy-site.yml`, which builds and then uploads the output
 * directly (Workers assets API, or `wrangler pages deploy` for a Pages project).
 *
 * Credentials are resolved environment-first, then from the settings the
 * existing Admin → Deploy surface already writes (`deploy.github_token`,
 * `deploy.github_repo`), then from the site's own `gitRepo`. The token is never
 * returned to a client — see {@link githubDeployStatus}.
 */

export const DEFAULT_SITE_WORKFLOW = 'deploy-site.yml'

type Env = Record<string, unknown>

/** Minimal settings surface, so this module stays testable without the service. */
export interface SettingsLike {
  getSetting(category: string, key: string): Promise<any | null>
}

export interface GithubDispatchTarget {
  token: string
  repo: string
  workflow: string
  ref: string
  source: 'env' | 'settings'
}

export interface GithubDeployStatus {
  configured: boolean
  repo: string | null
  workflow: string
  ref: string
  hasToken: boolean
  source: 'env' | 'settings' | 'none'
}

export interface DispatchResult {
  ok: boolean
  status: number
  error?: string
  /** Where the runs of this workflow can be watched. */
  runUrl: string
}

const readEnvString = (env: Env | undefined, key: string): string => {
  const value = env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Accept `owner/name`, a clone URL, or a browser URL and return `owner/name`.
 * A trailing `.git` and any leading scheme/host are dropped.
 */
export const normalizeRepo = (value: string | null | undefined): string => {
  const raw = (value ?? '').trim()
  if (raw === '') return ''
  return raw
    .replace(/^git\+/, '')
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/^git@[^:]+:/i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '')
}

/** Resolve the token/repo/workflow/ref a dispatch would use, or null when unusable. */
export async function resolveGithubDispatch(
  env: Env | undefined,
  settings: SettingsLike | undefined,
  site?: { gitRepo?: string | null; gitBranch?: string | null }
): Promise<GithubDispatchTarget | null> {
  const envToken = readEnvString(env, 'GITHUB_TOKEN') || readEnvString(env, 'GH_DISPATCH_TOKEN')
  const envRepo = normalizeRepo(readEnvString(env, 'GITHUB_REPO'))

  const settingsToken = settings ? ((await settings.getSetting('deploy', 'github_token')) ?? '') : ''
  const settingsRepo = settings ? ((await settings.getSetting('deploy', 'github_repo')) ?? '') : ''

  const token = (envToken || String(settingsToken)).trim()
  const repo = envRepo || normalizeRepo(String(settingsRepo)) || normalizeRepo(site?.gitRepo)
  if (!token || !repo) return null

  const envWorkflow = readEnvString(env, 'GITHUB_SITE_WORKFLOW')
  const settingsWorkflow = settings ? await settings.getSetting('deploy', 'site_workflow') : ''
  const envRef = readEnvString(env, 'GITHUB_REF')
  const settingsRef = settings ? await settings.getSetting('deploy', 'site_ref') : ''

  return {
    token,
    repo,
    workflow: envWorkflow || String(settingsWorkflow ?? '') || DEFAULT_SITE_WORKFLOW,
    ref: envRef || String(settingsRef ?? '') || site?.gitBranch || 'main',
    source: envToken || envRepo ? 'env' : 'settings'
  }
}

/** Client-safe view of the GitHub dispatch configuration. */
export async function githubDeployStatus(
  env: Env | undefined,
  settings: SettingsLike | undefined,
  site?: { gitRepo?: string | null; gitBranch?: string | null }
): Promise<GithubDeployStatus> {
  const target = await resolveGithubDispatch(env, settings, site)
  if (!target) {
    const fallbackRepo = normalizeRepo(site?.gitRepo)
    return {
      configured: false,
      repo: fallbackRepo || null,
      workflow: DEFAULT_SITE_WORKFLOW,
      ref: site?.gitBranch || 'main',
      hasToken: false,
      source: 'none'
    }
  }
  return {
    configured: true,
    repo: target.repo,
    workflow: target.workflow,
    ref: target.ref,
    hasToken: true,
    source: target.source
  }
}

/**
 * Turn GitHub's status codes into the action the operator actually has to take.
 * These are the failures seen in practice, and a bare status code sends people
 * looking in the wrong place.
 */
const describeGithubError = (status: number, detail: string): string => {
  const tail = detail ? `: ${detail.slice(0, 300)}` : ''
  switch (status) {
    case 401:
      return `GitHub rejected the token (401)${tail} — it is invalid or expired. Save a new one under Admin → Deploy settings.`
    case 403:
      return `GitHub refused the request (403)${tail} — the token needs "Actions: write" (fine-grained) or the "workflow" scope (classic) on this repository.`
    case 404:
      return `GitHub returned 404${tail} — either the repository name is wrong or the token cannot see it, and an unknown workflow file also answers 404. Check the repo and that .github/workflows/${DEFAULT_SITE_WORKFLOW} exists on the selected ref.`
    case 422:
      return `GitHub rejected the dispatch (422)${tail} — usually the ref does not exist, the workflow has no workflow_dispatch trigger, or the inputs do not match its declared inputs.`
    default:
      return `GitHub API returned ${status}${tail}`
  }
}

/** Start a workflow run. Never throws: the caller records the outcome. */
export async function dispatchWorkflow(
  target: GithubDispatchTarget,
  inputs: Record<string, string>
): Promise<DispatchResult> {
  const runUrl = `https://github.com/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}`
  try {
    const response = await fetch(
      `https://api.github.com/repos/${target.repo}/actions/workflows/${encodeURIComponent(target.workflow)}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${target.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'SciFiCMS-Admin'
        },
        body: JSON.stringify({ ref: target.ref, inputs })
      }
    )

    // 204 No Content is the documented success answer for a dispatch.
    if (response.status === 204) return { ok: true, status: 204, runUrl }

    const detail = await response.text().catch(() => '')
    return { ok: false, status: response.status, error: describeGithubError(response.status, detail), runUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispatch request failed'
    return { ok: false, status: 0, error: `Could not reach the GitHub API: ${message}`, runUrl }
  }
}
