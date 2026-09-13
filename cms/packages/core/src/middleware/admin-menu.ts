/**
 * Admin Menu Middleware
 *
 * Queries active collections from D1 and builds the dynamic menu items
 * array for the admin sidebar. Runs on all /admin/* routes.
 */

import type { Context, Next } from 'hono'
import { ADMIN_LANGUAGE_COOKIE, resolveAdminLocale, setAdminLocale } from '../i18n/admin'
import { icon, collectionIcon } from '../templates/icons'
import { setDynamicMenuItems } from '../templates/layouts/admin-layout-v2.template'
import { setCatalystDynamicMenuItems } from '../templates/layouts/admin-layout-catalyst.template'

export interface AdminMenuItem {
  label: string
  slug: string
  collectionId: string
  icon: string
}

/**
 * Middleware that attaches `adminMenuItems` to the Hono context.
 * Each admin route handler can then read `c.get('adminMenuItems')` and
 * pass it as `dynamicMenuItems` to the layout template.
 */
export function adminMenuMiddleware() {
  // Cache menu items per isolate to avoid querying DB on every request
  let cachedItems: AdminMenuItem[] | null = null
  let cacheTimestamp = 0
  const CACHE_TTL = 60_000 // 1 minute

  // The language setting is the fallback for requests that carry no cookie, so it
  // is cached the same way rather than read on every page.
  let cachedLanguage: string | null = null
  let languageTimestamp = 0

  return async (c: Context, next: Next) => {
    const now = Date.now()

    if (!cachedItems || now - cacheTimestamp > CACHE_TTL) {
      try {
        const db = c.env.DB
        if (db) {
          const result = await db.prepare(
            `SELECT id, name, display_name FROM collections WHERE is_active = 1 ORDER BY display_name ASC, name ASC`
          ).all()

          cachedItems = (result.results || []).map((row: any) => ({
            label: row.display_name || row.name,
            slug: row.name,
            collectionId: row.id,
            icon: icon(collectionIcon(), 'h-5 w-5 shrink-0'),
          }))
          cacheTimestamp = now
        }
      } catch (err) {
        console.error('adminMenuMiddleware: failed to query collections', err)
        // Fall back to empty if query fails
        if (!cachedItems) cachedItems = []
      }
    }

    // Which language the admin is read in: the switcher's cookie wins, the
    // `language` setting is the default. The templates read it synchronously below.
    if (!cachedLanguage || now - languageTimestamp > CACHE_TTL) {
      try {
        const db = c.env.DB
        if (db) {
          const row: any = await db
            .prepare(`SELECT value FROM settings WHERE category = 'general' AND key = 'language'`)
            .first()
          cachedLanguage = row?.value ? String(row.value).replace(/^"|"$/g, '') : 'en'
          languageTimestamp = now
        }
      } catch (err) {
        console.error('adminMenuMiddleware: failed to read the language setting', err)
      }
    }

    const cookie = getCookie(c, ADMIN_LANGUAGE_COOKIE)
    setAdminLocale(resolveAdminLocale(cookie ?? cachedLanguage))

    const items = cachedItems || []
    c.set('adminMenuItems', items)
    setDynamicMenuItems(items)
    setCatalystDynamicMenuItems(items)
    await next()
  }
}

/** Read one cookie without pulling in another dependency. */
const getCookie = (c: Context, name: string): string | null => {
  const header = c.req.header('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}
