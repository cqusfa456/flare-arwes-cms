import { describe, it, expect } from 'vitest'

import type { Site } from '../../services/sites'
import {
  isDeployed,
  publishesAppRoutes,
  publishesWebsite,
  siteContentMode
} from '../../services/site-routing'

/** Only the fields the routing classification reads. */
const site = (fields: {
  contentMode?: unknown
  contentRoutes?: unknown
  parentSiteId?: unknown
  publishesApp?: unknown
}): Site =>
  ({
    contentMode: fields.contentMode ?? null,
    contentRoutes: fields.contentRoutes ?? null,
    parentSiteId: fields.parentSiteId ?? null,
    publishesApp: fields.publishesApp ?? false
  }) as Site

describe('siteContentMode', () => {
  it('reads an explicit mode', () => {
    expect(siteContentMode(site({ contentMode: 'paths' }))).toBe('paths')
    expect(siteContentMode(site({ contentMode: 'standalone' }))).toBe('standalone')
  })

  it('treats a row with no mode as deployed', () => {
    // Every site that existed before migration 052 was deployed on its own.
    expect(siteContentMode(site({ contentRoutes: null }))).toBe('standalone')
    expect(siteContentMode(site({ contentRoutes: { 'blog-posts': '' } }))).toBe('standalone')
    expect(siteContentMode(site({ contentRoutes: '{"docs":""}' }))).toBe('standalone')
  })
})

describe('isDeployed', () => {
  it('is true only for a standalone site', () => {
    expect(isDeployed(site({ contentMode: 'standalone' }))).toBe(true)
    expect(isDeployed(site({ contentMode: 'paths', parentSiteId: 'p' }))).toBe(false)
  })
})

describe('publishesWebsite', () => {
  it('is true for a deployed site that declares no content routes', () => {
    expect(publishesWebsite(site({ contentMode: 'standalone' }))).toBe(true)
    expect(publishesWebsite(site({ contentRoutes: null }))).toBe(true)
  })

  it('is false for a content-only host and for a mounted site', () => {
    expect(publishesWebsite(site({ contentMode: 'standalone', contentRoutes: { docs: '' } }))).toBe(
      false
    )
    // A paths site has no host of its own: its parent publishes its content.
    expect(publishesWebsite(site({ contentMode: 'paths', parentSiteId: 'p' }))).toBe(false)
  })
})

describe('publishesAppRoutes', () => {
  it('is true for the site that declares no content routes', () => {
    expect(publishesAppRoutes(site({ contentMode: 'standalone' }))).toBe(true)
    expect(publishesAppRoutes(site({ contentRoutes: null }))).toBe(true)
  })

  it('is true for a content host that asked for the app beside its collections', () => {
    // The documentation host: the docs collection owns the root, the framework
    // site comes with it under /docs (migration 055).
    expect(
      publishesAppRoutes(
        site({ contentMode: 'standalone', contentRoutes: { docs: '' }, publishesApp: true })
      )
    ).toBe(true)
  })

  it('is false for a plain content host and for a mounted site', () => {
    expect(
      publishesAppRoutes(site({ contentMode: 'standalone', contentRoutes: { docs: '' } }))
    ).toBe(false)
    // The flag says nothing for a site the parent publishes.
    expect(
      publishesAppRoutes(
        site({ contentMode: 'paths', parentSiteId: 'p', contentRoutes: { docs: '' }, publishesApp: true })
      )
    ).toBe(false)
  })
})
