/**
 * The language the admin is read in.
 *
 * The header's switcher is a link here: it writes the reader's choice as a cookie
 * (so the setting stays a default for everyone rather than a global flip) and sends
 * them back to the page they were on.
 */

import { Hono } from 'hono'

import { ADMIN_LANGUAGE_COOKIE, resolveAdminLocale } from '../i18n/admin'

type Bindings = {
  DB: D1Database
  CACHE_KV: KVNamespace
}

const adminLanguageRoutes = new Hono<{ Bindings: Bindings; Variables: Record<string, unknown> }>()

adminLanguageRoutes.get('/language/:locale', (c) => {
  const locale = resolveAdminLocale(c.req.param('locale'))

  // Only ever return inside the admin: an open redirect here would be a way to
  // bounce a signed-in reader somewhere else.
  const requested = c.req.query('next') ?? ''
  const next = requested.startsWith('/admin') && !requested.startsWith('//') ? requested : '/admin'

  c.header(
    'Set-Cookie',
    `${ADMIN_LANGUAGE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
  )

  return c.redirect(next, 302)
})

export { adminLanguageRoutes }
