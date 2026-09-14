import { describe, it, expect } from 'vitest'

import {
  contentSiteScopeFragment,
  type ContentSiteScope
} from '../../services/content-site-scope'

/** Only the fields the fragment builder reads. */
const scope = (fields: Partial<ContentSiteScope>): ContentSiteScope => ({
  siteId: null,
  relatedSiteIds: [],
  siteSlug: null,
  requested: null,
  source: 'none',
  mode: 'site+shared',
  unknown: false,
  reason: 'test',
  ...fields
})

describe('contentSiteScopeFragment', () => {
  it('enforces nothing on a single-tenant deployment', () => {
    expect(contentSiteScopeFragment(scope({ mode: 'all' }))).toBeNull()
  })

  it('matches the site, the sites mounted on it, and what either is assigned', () => {
    const fragment = contentSiteScopeFragment(
      scope({ siteId: 'site-a', relatedSiteIds: ['site-a', 'mount-b'] })
    )

    expect(fragment?.sql).toContain('site_id IN (?, ?)')
    expect(fragment?.sql).toContain('SELECT content_id FROM content_sites')
    expect(fragment?.params).toEqual(['site-a', 'mount-b', 'site-a', 'mount-b'])
  })

  it('falls back to the identified site alone', () => {
    const fragment = contentSiteScopeFragment(scope({ siteId: 'site-a' }))

    expect(fragment?.sql).toContain('site_id IN (?)')
    expect(fragment?.params).toEqual(['site-a', 'site-a'])
  })

  it('reads nothing when no site was identified', () => {
    // The assignment is the publication control: content assigned to no site is
    // published nowhere, so a request that names no site has nothing to read.
    expect(contentSiteScopeFragment(scope({ mode: 'shared-only' }))).toEqual({
      sql: '1 = 0',
      params: []
    })
  })
})
