/**
 * Admin Sync Routes — Content Staging API
 *
 * Provides endpoints for the Sync button:
 *   GET  /api/pending-count  — badge count for sidebar
 *   GET  /api/pending        — full list for Sync modal
 *   POST /api/approve        — approve a single revision
 *   POST /api/approve-all    — approve all pending revisions
 *   POST /api/reject         — reject a revision
 *   GET  /api/content-version — current content version (public, for frontend freshness check)
 */

import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware'
import type { KVNamespace } from '@cloudflare/workers-types'
import {
  getPendingCount,
  getPendingRevisions,
  approveRevision,
  approveAllRevisions,
  rejectRevision,
  computeDiff,
} from '../services/revisions'
import { SitesService, type Site } from '../services/sites'
import { SettingsService } from '../services/settings'
import { getCacheService, CACHE_CONFIGS } from '../services/cache'
import { logAudit, getClientIP } from '../services/audit-log'
import type { Bindings, Variables } from '../app'

const adminSyncRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

/** Collections that are chrome rather than content: every site renders them. */
const CHROME_COLLECTIONS = ['components', 'layouts']

/**
 * Which sites a change reaches: one that publishes the collection, every site when
 * the change is chrome (the navigation bar, the footer, a layout), and the app site
 * — which has no content routes of its own — for everything it is not denied.
 */
const sitesPublishing = (sites: Site[], collections: string[]): Site[] => {
  const touchesChrome = collections.some((name) => CHROME_COLLECTIONS.includes(name))
  if (touchesChrome) {
    return sites
  }
  return sites.filter(
    (site) =>
      !site.contentRoutes || collections.some((name) => site.contentRoutes?.[name] !== undefined)
  )
}

/**
 * Build the sites a go-live reaches.
 *
 * The admin's Go Live publishes revisions in the CMS; a website is a static build, so
 * without this the content would be live and the website would still be old. Failures
 * are reported rather than thrown: the approval itself already happened.
 */
const buildSitesForCollections = async (
  c: { env: Bindings },
  collections: string[]
): Promise<{ built: string[]; failed: string[] }> => {
  const built: string[] = []
  const failed: string[] = []
  try {
    const service = new SitesService(
      c.env.DB,
      c.env as unknown as Record<string, unknown>,
      new SettingsService(c.env.DB)
    )
    const sites = (await service.list()).filter((site) => site.isActive !== false)
    for (const site of sitesPublishing(sites, collections)) {
      try {
        const result = await service.triggerBuild(site.id)
        if (result.ok) {
          built.push(site.slug)
        } else {
          failed.push(site.slug)
        }
      } catch {
        failed.push(site.slug)
      }
    }
  } catch (err) {
    console.error('admin-sync: could not build sites after go-live', err)
  }
  return { built, failed }
}

const CONTENT_VERSION_KEY = 'sci-fi:content_version'

/**
 * Get the current content version from KV.
 * Returns 0 if not set (first run).
 */
async function getContentVersion(kv: KVNamespace): Promise<number> {
  const val = await kv.get(CONTENT_VERSION_KEY)
  return val ? parseInt(val, 10) : 0
}

/**
 * Bump the content version in KV.
 * Called after Go Live approves revisions.
 */
async function bumpContentVersion(kv: KVNamespace): Promise<number> {
  const current = await getContentVersion(kv)
  const next = current + 1
  await kv.put(CONTENT_VERSION_KEY, String(next))
  return next
}

// Public endpoint — no auth required. Frontend calls this to check freshness.
adminSyncRoutes.get('/api/content-version', async (c) => {
  const kv = c.env.CACHE_KV
  const version = await getContentVersion(kv)
  return c.json({ version }, 200, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  })
})

// Auth for all routes except content-version (which is public)
adminSyncRoutes.use('/api/pending-count', requireAuth())
adminSyncRoutes.use('/api/pending', requireAuth())
adminSyncRoutes.use('/api/approve', requireAuth())
adminSyncRoutes.use('/api/approve-all', requireAuth())
adminSyncRoutes.use('/api/reject', requireAuth())

// Badge count — lightweight, called on every page load
adminSyncRoutes.get('/api/pending-count', async (c) => {
  const db = c.env.DB
  const count = await getPendingCount(db)
  return c.json({ count })
})

// Full pending list for the Sync modal
adminSyncRoutes.get('/api/pending', async (c) => {
  const db = c.env.DB
  const revisions = await getPendingRevisions(db)

  // Compute diffs for each revision
  const revisionsWithDiffs = revisions.map((rev) => {
    const pendingClean = { ...rev.pendingData }
    delete pendingClean._revision_meta
    const diffs = computeDiff(rev.liveData as Record<string, unknown>, pendingClean)
    return { ...rev, diffs }
  })

  return c.json({
    success: true,
    revisions: revisionsWithDiffs,
    count: revisions.length,
  })
})

// Approve a single revision (editors + admins)
adminSyncRoutes.post('/api/approve', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const body = await c.req.json<{ versionId: string }>()

  if (!body.versionId) {
    return c.json({ error: 'versionId is required' }, 400)
  }

  try {
    // What this revision changes decides which sites have to be built again.
    const revision = (await getPendingRevisions(db)).find((rev) => rev.versionId === body.versionId)
    await approveRevision(db, body.versionId, user!.userId)

    // Invalidate ALL caches (admin content cache + public API cache)
    const contentCache = getCacheService(CACHE_CONFIGS.content!)
    await contentCache.invalidate('*')
    const apiCache = getCacheService(CACHE_CONFIGS.api!)
    await apiCache.invalidate('*')
    const newVersion = await bumpContentVersion(c.env.CACHE_KV)

    logAudit(db, { userId: user!.userId, userEmail: user!.email, action: 'content.sync_approve', resourceType: 'content', resourceId: body.versionId, ipAddress: getClientIP(c.req) })

    const sites = await buildSitesForCollections(
      c,
      revision?.collectionName ? [revision.collectionName] : []
    )

    return c.json({
      success: true,
      message: 'Revision approved and published',
      contentVersion: newVersion,
      sitesBuilt: sites.built,
      sitesFailed: sites.failed
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to approve revision' }, 500)
  }
})

// Approve all pending revisions (admins only)
adminSyncRoutes.post('/api/approve-all', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const db = c.env.DB

  try {
    const pending = await getPendingRevisions(db)
    const count = await approveAllRevisions(db, user!.userId)

    // Invalidate ALL caches (admin content cache + public API cache)
    const contentCache = getCacheService(CACHE_CONFIGS.content!)
    await contentCache.invalidate('*')
    const apiCache = getCacheService(CACHE_CONFIGS.api!)
    await apiCache.invalidate('*')
    const newVersion = await bumpContentVersion(c.env.CACHE_KV)

    logAudit(db, { userId: user!.userId, userEmail: user!.email, action: 'content.sync_approve', resourceType: 'content', details: { count }, ipAddress: getClientIP(c.req) })

    const sites = await buildSitesForCollections(
      c,
      [...new Set(pending.map((rev) => rev.collectionName).filter(Boolean))]
    )

    return c.json({
      success: true,
      message: `${count} revision(s) approved and published`,
      count,
      contentVersion: newVersion,
      sitesBuilt: sites.built,
      sitesFailed: sites.failed
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to approve revisions' }, 500)
  }
})

// Reject a revision
adminSyncRoutes.post('/api/reject', async (c) => {
  const user = c.get('user')
  const db = c.env.DB
  const body = await c.req.json<{ versionId: string; comment?: string }>()

  if (!body.versionId) {
    return c.json({ error: 'versionId is required' }, 400)
  }

  try {
    await rejectRevision(db, body.versionId, user!.userId, body.comment)

    logAudit(db, { userId: user!.userId, userEmail: user!.email, action: 'content.sync_reject', resourceType: 'content', resourceId: body.versionId, ipAddress: getClientIP(c.req) })

    return c.json({ success: true, message: 'Revision rejected' })
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to reject revision' }, 500)
  }
})

export { adminSyncRoutes }
