import { afterEach, describe, expect, it, vi } from 'vitest'

import { SitesService } from '../../services/sites'

/**
 * DNS for a bound domain is the step that used to happen by hand in the Cloudflare
 * dashboard. These cases pin the part that has to be careful: the CMS creates a
 * record when the name is free, leaves an equivalent one alone, and never repoints a
 * name that already serves something else unless the operator claims it.
 */

const siteRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'site-1',
  slug: 'home',
  name: 'Home',
  description: null,
  provider: 'cloudflare-pages',
  deploy_mode: 'github-actions',
  cf_project_name: 'home-project',
  cf_worker_tag: null,
  cf_trigger_uuid: null,
  cf_zone_id: null,
  content_mode: 'standalone',
  parent_site_id: null,
  site_domain: null,
  content_prefix: null,
  content_routes: null,
  build_env: null,
  is_active: 1,
  ...overrides
})

const domainRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'domain-1',
  site_id: 'site-1',
  hostname: 'docs.example.com',
  status: 'pending',
  cf_domain_id: 'cf-domain-1',
  cf_zone_id: null,
  validation_status: 'pending',
  validation_errors: null,
  is_primary: 0,
  dns_status: null,
  dns_target: null,
  dns_record_id: null,
  dns_checked_at: null,
  created_at: 1,
  updated_at: 1,
  ...overrides
})

/** A D1 stand-in that answers the handful of statements this path runs. */
const fakeDb = (site: Record<string, unknown>, domain: Record<string, unknown>) => {
  const state = { domain: { ...domain }, updates: [] as Array<Record<string, unknown>> }
  const db = {
    prepare(sql: string) {
      const query = sql.replace(/\s+/g, ' ').trim()
      return {
        bind: (...params: unknown[]) => ({
          first: async () => {
            if (/FROM sites WHERE id = \? OR slug = \?/i.test(query)) return site
            if (/FROM site_domains WHERE site_id = \? AND hostname = \?/i.test(query)) {
              return state.domain
            }
            if (/FROM site_domains WHERE id = \?/i.test(query)) return state.domain
            return null
          },
          run: async () => {
            if (/UPDATE site_domains SET dns_status/i.test(query)) {
              state.domain = {
                ...state.domain,
                dns_status: params[0],
                dns_target: params[1],
                dns_record_id: params[2],
                dns_checked_at: params[3],
                updated_at: params[4]
              }
              state.updates.push({ sql: query, params })
            }
            return { success: true }
          }
        })
      }
    }
  }
  return { db, state }
}

const json = (result: unknown) =>
  new Response(JSON.stringify({ success: true, result, errors: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

const service = (db: unknown, env: Record<string, unknown> = {}) =>
  new SitesService(db as never, { CF_API_TOKEN: 'token', CF_ACCOUNT_ID: 'account', ...env })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ensureDomainDns', () => {
  it('creates the record when the name is free', async () => {
    const { db, state } = fakeDb(siteRow(), domainRow())
    const calls: Array<{ method: string; path: string; body?: unknown }> = []
    vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string } = {}) => {
      const path = String(url).replace('https://api.cloudflare.com/client/v4', '')
      calls.push({ method: init.method ?? 'GET', path, body: init.body ? JSON.parse(init.body) : undefined })
      if (path.startsWith('/zones?')) return json([{ id: 'zone-1', name: 'example.com' }])
      if (path.startsWith('/zones/zone-1/dns_records?')) return json([])
      if (path === '/zones/zone-1/dns_records') return json({ id: 'record-1' })
      throw new Error(`unexpected call ${path}`)
    })

    const domain = await service(db).ensureDomainDns('site-1', 'docs.example.com')

    expect(domain.dnsStatus).toBe('created')
    expect(domain.dnsTarget).toBe('home-project.pages.dev')
    expect(domain.dnsRecordId).toBe('record-1')
    const created = calls.find((call) => call.method === 'POST' && call.path === '/zones/zone-1/dns_records')
    expect(created?.body).toMatchObject({
      type: 'CNAME',
      name: 'docs.example.com',
      content: 'home-project.pages.dev',
      proxied: true
    })
    expect(state.domain.dns_status).toBe('created')
  })

  it('leaves an equivalent record alone', async () => {
    const { db } = fakeDb(siteRow(), domainRow())
    vi.stubGlobal('fetch', async (url: string, init: { method?: string } = {}) => {
      const path = String(url).replace('https://api.cloudflare.com/client/v4', '')
      if (path.startsWith('/zones?')) return json([{ id: 'zone-1', name: 'example.com' }])
      if (path.startsWith('/zones/zone-1/dns_records?')) {
        return json([
          { id: 'record-1', type: 'CNAME', name: 'docs.example.com', content: 'home-project.pages.dev' }
        ])
      }
      throw new Error(`wrote to Cloudflare: ${init.method} ${path}`)
    })

    const domain = await service(db).ensureDomainDns('site-1', 'docs.example.com')

    expect(domain.dnsStatus).toBe('current')
    expect(domain.dnsRecordId).toBe('record-1')
  })

  it('reports a conflict instead of repointing a name that serves something else', async () => {
    const { db } = fakeDb(siteRow(), domainRow())
    let wrote = false
    vi.stubGlobal('fetch', async (url: string, init: { method?: string } = {}) => {
      const path = String(url).replace('https://api.cloudflare.com/client/v4', '')
      if (path.startsWith('/zones?')) return json([{ id: 'zone-1', name: 'example.com' }])
      if (path.startsWith('/zones/zone-1/dns_records?')) {
        return json([
          { id: 'record-9', type: 'CNAME', name: 'docs.example.com', content: 'somewhere-else.pages.dev' }
        ])
      }
      wrote = true
      return json({})
    })

    const domain = await service(db).ensureDomainDns('site-1', 'docs.example.com')

    expect(domain.dnsStatus).toBe('conflict')
    expect(domain.dnsTarget).toBe('somewhere-else.pages.dev')
    expect(wrote).toBe(false)
  })

  it('repoints when the operator takes the name over', async () => {
    const { db, state } = fakeDb(siteRow(), domainRow())
    const methods: string[] = []
    vi.stubGlobal('fetch', async (url: string, init: { method?: string } = {}) => {
      const path = String(url).replace('https://api.cloudflare.com/client/v4', '')
      methods.push(`${init.method ?? 'GET'} ${path}`)
      if (path.startsWith('/zones?')) return json([{ id: 'zone-1', name: 'example.com' }])
      if (path.startsWith('/zones/zone-1/dns_records?')) {
        return json([{ id: 'record-9', type: 'A', name: 'docs.example.com', content: '192.0.2.1' }])
      }
      if (path === '/zones/zone-1/dns_records/record-9') return json({ id: 'record-9' })
      throw new Error(`unexpected call ${path}`)
    })

    const domain = await service(db).ensureDomainDns('site-1', 'docs.example.com', {
      takeOver: true
    })

    expect(domain.dnsStatus).toBe('updated')
    expect(domain.dnsTarget).toBe('home-project.pages.dev')
    expect(methods).toContain('PATCH /zones/zone-1/dns_records/record-9')
    expect(state.domain.dns_status).toBe('updated')
  })

  it('has nothing to do for a provider that makes its own record', async () => {
    const { db } = fakeDb(siteRow({ provider: 'cloudflare-worker', cf_project_name: 'cms' }), domainRow())
    vi.stubGlobal('fetch', async () => {
      throw new Error('should not call Cloudflare')
    })

    const domain = await service(db).ensureDomainDns('site-1', 'docs.example.com')

    expect(domain.dnsStatus).toBe('unsupported')
  })

  it('creates the record beside the mail rows an apex carries', async () => {
    const { db } = fakeDb(siteRow(), domainRow({ hostname: 'example.com' }))
    const writes: string[] = []
    vi.stubGlobal('fetch', async (url: string, init: { method?: string; body?: string } = {}) => {
      const path = String(url).replace('https://api.cloudflare.com/client/v4', '')
      if (path.startsWith('/zones?')) return json([{ id: 'zone-1', name: 'example.com' }])
      if (path.startsWith('/zones/zone-1/dns_records?')) {
        // A mail-enabled apex: MX and SPF/DKIM rows live at the same name.
        return json([
          { id: 'mx-1', type: 'MX', name: 'example.com', content: 'mail.example.com' },
          { id: 'spf-1', type: 'TXT', name: 'example.com', content: 'v=spf1 -all' }
        ])
      }
      if (path !== '/zones/zone-1/dns_records') throw new Error(`unexpected call ${path}`)
      writes.push(String(init.body))
      return json({ id: 'record-1' })
    })

    const domain = await service(db).ensureDomainDns('site-1', 'example.com')

    expect(domain.dnsStatus).toBe('created')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0])).toMatchObject({ type: 'CNAME', name: 'example.com' })
  })

  it('never rewrites a mail row, even when asked to take the name over', async () => {
    const { db } = fakeDb(siteRow(), domainRow({ hostname: 'example.com' }))
    const touched: string[] = []
    vi.stubGlobal('fetch', async (url: string, init: { method?: string } = {}) => {
      const path = String(url).replace('https://api.cloudflare.com/client/v4', '')
      if (path.startsWith('/zones?')) return json([{ id: 'zone-1', name: 'example.com' }])
      if (path.startsWith('/zones/zone-1/dns_records?')) {
        return json([{ id: 'mx-1', type: 'MX', name: 'example.com', content: 'mail.example.com' }])
      }
      touched.push(`${init.method} ${path}`)
      return json({ id: 'record-1' })
    })

    const domain = await service(db).ensureDomainDns('site-1', 'example.com', { takeOver: true })

    expect(domain.dnsStatus).toBe('created')
    expect(touched).toEqual(['POST /zones/zone-1/dns_records'])
  })

  it('refuses a hostname that is not bound to the site', async () => {
    const { db } = fakeDb(siteRow(), domainRow())
    const prepare = (db as { prepare: (sql: string) => unknown }).prepare
    ;(db as { prepare: (sql: string) => unknown }).prepare = (sql: string) =>
      /FROM site_domains WHERE site_id = \? AND hostname = \?/i.test(sql.replace(/\s+/g, ' '))
        ? { bind: () => ({ first: async () => null, run: async () => ({}) }) }
        : (prepare(sql) as never)

    await expect(service(db).ensureDomainDns('site-1', 'docs.example.com')).rejects.toThrow(
      /is not bound to this site/
    )
  })
})
