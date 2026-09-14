import { describe, expect, it } from 'vitest'

import type { Site } from '../../services/sites'
import { publishesAppRoutes, buildSiteRouting } from '../../services/site-routing'

/**
 * The routing a build reads (`GET /api/site`) decides whether a site generates the
 * website's own routes and whether its links to them stay on this host. These cases
 * pin the three shapes that matter since migration 055:
 *
 *   * the website site            — publishes the app, links to it locally;
 *   * a plain content host        — no app routes, links to the website site;
 *   * a content host with the app — its own collection at the root *and* the app,
 *                                   so it links to the app's pages locally.
 */

const site = (overrides: Partial<Site> & { id: string; slug: string }): Site =>
  ({
    name: overrides.slug,
    description: null,
    provider: 'cloudflare-pages',
    deployMode: 'github-actions',
    cfProjectName: null,
    cfWorkerTag: null,
    cfTriggerUuid: null,
    cfZoneId: null,
    gitRepo: null,
    gitBranch: 'main',
    deployHookUrl: null,
    buildCommand: null,
    deployCommand: null,
    outputDir: null,
    rootDir: null,
    nodeVersion: null,
    buildConfigSyncedAt: null,
    contentPrefix: null,
    contentRoutes: null,
    contentMode: 'standalone',
    publishesApp: false,
    parentSiteId: null,
    buildEnv: {},
    contentToken: null,
    contentTokenId: null,
    isActive: true,
    lastBuildAt: null,
    lastBuildStatus: null,
    lastBuildId: null,
    lastBuildUrl: null,
    lastBuildError: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }) as Site

/** A D1 stand-in answering the two lookups `buildSiteRouting` runs. */
const fakeDb = (sites: Site[], domains: Array<{ site_id: string; hostname: string }> = []) => ({
  prepare(sql: string) {
    const query = sql.replace(/\s+/g, ' ').trim()
    return {
      all: async () => {
        if (/FROM sites WHERE is_active = 1/i.test(query)) {
          return {
            results: sites.map((entry) => ({
              ...entry,
              content_routes: entry.contentRoutes ? JSON.stringify(entry.contentRoutes) : null,
              content_mode: entry.contentMode,
              publishes_app: entry.publishesApp ? 1 : 0,
              parent_site_id: entry.parentSiteId,
              is_active: entry.isActive ? 1 : 0,
              cf_project_name: entry.cfProjectName
            }))
          }
        }
        if (/FROM site_domains/i.test(query)) return { results: domains }
        return { results: [] }
      },
      bind: () => ({ all: async () => ({ results: [] }), first: async () => null, run: async () => ({ success: true }) }),
      first: async () => null,
      run: async () => ({ success: true })
    }
  }
})

const website = site({
  id: 'app',
  slug: 'home',
  cfProjectName: 'home-project',
  contentRoutes: null
})

const host = (overrides: Partial<Site>) =>
  site({
    id: 'docs',
    slug: 'docs',
    cfProjectName: 'docs-project',
    contentRoutes: { docs: '' },
    ...overrides
  })

const dbWith = (sites: Site[]) =>
  fakeDb(sites, [
    { site_id: 'app', hostname: 'cqusfa.top' },
    { site_id: 'docs', hostname: 'docs.cqusfa.top' }
  ]) as unknown as D1Database

describe('publishesAppRoutes', () => {
  it('answers for each shape of site', () => {
    expect(publishesAppRoutes(website)).toBe(true)
    expect(publishesAppRoutes(host({}))).toBe(false)
    expect(publishesAppRoutes(host({ publishesApp: true }))).toBe(true)
    expect(
      publishesAppRoutes(
        site({ id: 'mounted', slug: 'mounted', contentMode: 'paths', parentSiteId: 'app', contentRoutes: { docs: '' }, publishesApp: true })
      )
    ).toBe(false)
  })
})

describe('buildSiteRouting', () => {
  it('reports the website site as publishing the app, with no base URL to link to', async () => {
    const routing = await buildSiteRouting(dbWith([website, host({})]), website)
    expect(routing.publishesApp).toBe(true)
    expect(routing.appBaseUrl).toBeNull()
    expect(routing.contentRoutes).toBeNull()
  })

  it('links a plain content host to the website site', async () => {
    const current = host({})
    const routing = await buildSiteRouting(dbWith([website, current]), current)
    // The framework site is not published here, so /docs and /demos point at home.
    expect(routing.publishesApp).toBe(false)
    expect(routing.appBaseUrl).toBe('https://cqusfa.top')
    expect(routing.contentRoutes).toEqual({ docs: '' })
  })

  it('keeps the app’s links local on a content host that publishes it', async () => {
    const current = host({ publishesApp: true })
    const routing = await buildSiteRouting(dbWith([website, current]), current)
    expect(routing.publishesApp).toBe(true)
    expect(routing.appBaseUrl).toBeNull()
    // Its own collection still owns the root, and the blog stays on the other host.
    expect(routing.contentRoutes).toEqual({ docs: '' })
  })
})
