import { describe, it, expect } from 'vitest'

import type { Site } from '../../services/sites'
import { publishesWebsite, siteContentMode } from '../../services/site-routing'

/** Only the fields the routing classification reads. */
const site = (fields: { contentMode?: unknown; contentRoutes?: unknown }): Site =>
  ({
    contentMode: fields.contentMode ?? null,
    contentRoutes: fields.contentRoutes ?? null
  }) as Site

describe('siteContentMode', () => {
  it('reads an explicit mode', () => {
    expect(siteContentMode(site({ contentMode: 'paths' }))).toBe('paths')
    expect(siteContentMode(site({ contentMode: 'standalone' }))).toBe('standalone')
  })

  it('classifies rows that predate migration 051 from what they already do', () => {
    // No content routes: the site built the whole website, as every site did before.
    expect(siteContentMode(site({ contentRoutes: null }))).toBe('paths')
    // Content routes: it was a content-only host publishing exactly those.
    expect(siteContentMode(site({ contentRoutes: { 'blog-posts': '' } }))).toBe('standalone')
  })

  it('accepts the routes as they are stored (a JSON string)', () => {
    expect(siteContentMode(site({ contentRoutes: '{"docs":""}' }))).toBe('standalone')
  })
})

describe('publishesWebsite', () => {
  it('is true for a site that publishes the website, routes or not', () => {
    expect(publishesWebsite(site({ contentMode: 'paths' }))).toBe(true)
    // A paths site may override prefixes without ceasing to publish the website.
    expect(publishesWebsite(site({ contentMode: 'paths', contentRoutes: { docs: '/docs' } }))).toBe(
      true
    )
    // No routes at all is the historical "app site", whatever the column says.
    expect(publishesWebsite(site({ contentRoutes: null }))).toBe(true)
  })

  it('is false for a content-only host', () => {
    expect(publishesWebsite(site({ contentMode: 'standalone', contentRoutes: { docs: '' } }))).toBe(
      false
    )
    // Classified from the routes when the column is empty (an older row).
    expect(publishesWebsite(site({ contentRoutes: { 'blog-posts': '' } }))).toBe(false)
  })
})
