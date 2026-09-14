/**
 * The public side of the agent onboarding link.
 *
 * `GET /agent/onboarding?token=…` answers with the document in
 * `services/agent-onboarding.ts`, and it is the token in the URL that authorises the
 * read — a revoked token stops serving the document, so an admin can always cut a
 * leaked link off from Admin → Agent 接入.
 *
 * The token is also accepted as `Authorization: Bearer …`, so an agent that already
 * holds it can fetch the document without putting it in a URL.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'

import { validateApiToken } from '../services/api-tokens'
import { buildAgentOnboarding } from '../services/agent-onboarding'
import type { Bindings, Variables } from '../app'

type AgentContext = Context<{ Bindings: Bindings; Variables: Variables }>

const unauthorized = (c: AgentContext, message: string): Response =>
  c.text(`# 无法提供 Agent 接入文档\n\n${message}\n\n请在 后台 → Agent 接入 里生成链接。\n`, 401)

const agentRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

agentRoutes.get('/onboarding', async (c) => {
  const header = c.req.header('Authorization') ?? ''
  const token = (c.req.query('token') ?? header.replace(/^Bearer\s+/i, '')).trim()

  if (!token) {
    return unauthorized(c, '缺少访问令牌：请使用后台生成的完整链接（带 `?token=`）。')
  }

  const result = await validateApiToken(c.env.DB, token)
  if (!result.valid) {
    return unauthorized(c, '令牌无效、已过期或已被吊销。')
  }

  const origin = new URL(c.req.url).origin
  const markdown = await buildAgentOnboarding(c.env.DB, {
    baseUrl: origin,
    token,
    version: c.get('appVersion') || '1.0.0'
  })

  return c.body(markdown, 200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    // The document embeds a credential and the site/collection list changes: never cache it.
    'Cache-Control': 'no-store'
  })
})

export { agentRoutes }
export default agentRoutes
