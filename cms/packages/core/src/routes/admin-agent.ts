/**
 * Admin → Agent 接入.
 *
 * One link that hands an agent everything it needs: the API document (built in
 * `services/agent-onboarding.ts`) and the token to call the API with. The page mints
 * the token, keeps its plaintext in `settings` so the same link can be shown again
 * (the API token service only stores a hash — the same deliberate exception the site
 * build token makes), and can rotate or revoke it.
 *
 * The public reader is `GET /agent/onboarding?token=…` (routes/agent.ts).
 */

import { Hono } from 'hono'
import { requireAuth, requireRole } from '../middleware'
import type { Context } from 'hono'

import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  validateApiToken
} from '../services/api-tokens'
import { buildAgentOnboarding } from '../services/agent-onboarding'
import { SettingsService } from '../services/settings'
import { logAudit, getClientIP } from '../services/audit-log'
import { renderAgentPage } from '../templates/pages/admin-agent.template'
import type { Bindings, Variables } from '../app'

const adminAgentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

adminAgentRoutes.use('*', requireAuth())
adminAgentRoutes.use('*', requireRole('admin'))

/** Settings row that holds the minted token; see the file header. */
const SETTINGS_CATEGORY = 'agent'
const TOKEN_KEY = 'access_token'
const TOKEN_ID_KEY = 'access_token_id'
const TOKEN_CREATED_KEY = 'access_token_created_at'
/** Name the token shows up under in Admin → API Tokens. */
const TOKEN_NAME = 'Agent onboarding'

type AgentContext = Context<{ Bindings: Bindings; Variables: Variables }>

const readState = async (c: AgentContext) => {
  const settings = new SettingsService(c.env.DB)
  const [token, tokenId, createdAt] = await Promise.all([
    settings.getSetting(SETTINGS_CATEGORY, TOKEN_KEY),
    settings.getSetting(SETTINGS_CATEGORY, TOKEN_ID_KEY),
    settings.getSetting(SETTINGS_CATEGORY, TOKEN_CREATED_KEY)
  ])

  const value = typeof token === 'string' && token.trim() !== '' ? token.trim() : null
  const valid = value ? (await validateApiToken(c.env.DB, value)).valid : false
  const tokens = await listApiTokens(c.env.DB)
  const record = tokens.find(
    (entry) =>
      entry.id === (typeof tokenId === 'string' ? tokenId : '') || entry.name === TOKEN_NAME
  )

  return {
    token: value,
    tokenIsValid: valid,
    tokenId: typeof tokenId === 'string' ? tokenId : null,
    createdAt: typeof createdAt === 'number' ? createdAt : null,
    tokenPrefix: record?.token_prefix ?? null,
    lastUsedAt: record?.last_used_at ?? null
  }
}

const onboardingUrl = (c: AgentContext, token: string): string =>
  `${new URL(c.req.url).origin}/agent/onboarding?token=${encodeURIComponent(token)}`

const agentPrompt = (url: string): string =>
  `请先读取这份接入文档，然后按里面的说明操作这个 CMS：\n${url}`

adminAgentRoutes.get('/', async (c) => {
  const user = c.get('user')
  const state = await readState(c)
  const origin = new URL(c.req.url).origin

  return c.html(
    renderAgentPage({
      docs: {
        openapi: `${origin}/api`,
        reference: `${origin}/admin/api-reference`,
        info: `${origin}/api/system/info`,
        health: `${origin}/api/system/health`
      },
      link: state.token && state.tokenIsValid ? onboardingUrl(c, state.token) : null,
      prompt: state.token && state.tokenIsValid ? agentPrompt(onboardingUrl(c, state.token)) : null,
      tokenPrefix: state.tokenPrefix,
      createdAt: state.createdAt,
      lastUsedAt: state.lastUsedAt,
      needsRotation: state.token !== null && !state.tokenIsValid,
      document:
        state.token && state.tokenIsValid
          ? await buildAgentOnboarding(c.env.DB, {
              baseUrl: new URL(c.req.url).origin,
              token: state.token,
              version: c.get('appVersion') || '1.0.0'
            })
          : null,
      user: user ? { name: user.email, email: user.email, role: user.role } : undefined,
      version: c.get('appVersion')
    })
  )
})

/**
 * Mint (or return) the link's token.
 *
 * `rotate: true` revokes the token in use and mints a new one, which is how a leaked
 * link is cut off — the old URL stops being served immediately.
 */
adminAgentRoutes.post('/api/link', async (c) => {
  const user = c.get('user')
  const settings = new SettingsService(c.env.DB)
  const body = (await c.req.json().catch(() => ({}))) as { rotate?: boolean }

  const existingId = await settings.getSetting(SETTINGS_CATEGORY, TOKEN_ID_KEY)
  const existingToken = await settings.getSetting(SETTINGS_CATEGORY, TOKEN_KEY)
  const existing =
    typeof existingToken === 'string' && existingToken.trim() !== ''
      ? await validateApiToken(c.env.DB, existingToken.trim())
      : { valid: false as const }

  if (!body.rotate && existing.valid && typeof existingToken === 'string') {
    const url = onboardingUrl(c, existingToken.trim())
    return c.json({ success: true, url, prompt: agentPrompt(url), rotated: false })
  }

  if (typeof existingId === 'string' && existingId !== '') {
    await revokeApiToken(c.env.DB, existingId).catch(() => undefined)
  }

  const created = await createApiToken(c.env.DB, {
    name: TOKEN_NAME,
    userId: user!.userId,
    // All collections, writable: an agent that can only read cannot do the work the link
    // is for — and it has to be able to manage sites, which is an admin route. The token
    // acts as the user who minted it (see requireAuth), so an admin link can too. It can
    // be revoked from this page at any time.
    allowedCollections: null,
    expiresAt: null,
    isReadOnly: false
  })

  await settings.setSetting(SETTINGS_CATEGORY, TOKEN_KEY, created.tokenValue)
  await settings.setSetting(SETTINGS_CATEGORY, TOKEN_ID_KEY, created.id)
  await settings.setSetting(SETTINGS_CATEGORY, TOKEN_CREATED_KEY, Date.now())

  const url = onboardingUrl(c, created.tokenValue)
  logAudit(c.env.DB, {
    userId: user?.userId || 'unknown',
    userEmail: user?.email || '',
    action: 'agent.link_created',
    resourceType: 'api_token',
    resourceId: created.id,
    resourceTitle: TOKEN_NAME,
    details: { rotated: !!body.rotate },
    ipAddress: getClientIP(c.req)
  })

  return c.json({ success: true, url, prompt: agentPrompt(url), rotated: !!body.rotate })
})

adminAgentRoutes.post('/api/revoke', async (c) => {
  const user = c.get('user')
  const settings = new SettingsService(c.env.DB)
  const tokenId = await settings.getSetting(SETTINGS_CATEGORY, TOKEN_ID_KEY)

  if (typeof tokenId === 'string' && tokenId !== '') {
    await revokeApiToken(c.env.DB, tokenId).catch(() => undefined)
  }

  await settings.setSetting(SETTINGS_CATEGORY, TOKEN_KEY, '')
  await settings.setSetting(SETTINGS_CATEGORY, TOKEN_ID_KEY, '')
  await settings.setSetting(SETTINGS_CATEGORY, TOKEN_CREATED_KEY, null)

  logAudit(c.env.DB, {
    userId: user?.userId || 'unknown',
    userEmail: user?.email || '',
    action: 'agent.link_revoked',
    resourceType: 'api_token',
    resourceId: typeof tokenId === 'string' ? tokenId : 'unknown',
    resourceTitle: TOKEN_NAME,
    details: {},
    ipAddress: getClientIP(c.req)
  })

  return c.json({ success: true })
})

export { adminAgentRoutes }
export default adminAgentRoutes
