/**
 * The document an agent reads to work with this CMS.
 *
 * `GET /agent/onboarding?token=…` serves it (routes/agent.ts) and the admin builds the
 * link for it (routes/admin-agent.ts). One URL carries everything an agent needs: the
 * API's shape, the rules that are not obvious from the endpoints, and the token to call
 * it with — which is why the link itself is a credential and can be revoked.
 *
 * Written for a reader that will *call* the API rather than click through the admin, so
 * every rule that a human would pick up from the interface is spelled out: content is
 * published to the sites it is assigned to, publishing goes through the staging queue,
 * and a static site only shows the change once it has been built.
 */

import { SitesService, type Site } from './sites'

export interface AgentOnboardingInput {
  /** Origin the CMS is reachable at, without a trailing slash. */
  baseUrl: string
  /** The token this document is served for. */
  token: string
  version: string
}

const describeMode = (site: Site): string => {
  if (site.contentMode !== 'paths') {
    return Object.keys(parseRoutes(site.contentRoutes)).length === 0
      ? '独立模式（发布整个网站）'
      : '独立模式（只发布所列集合）'
  }
  return `路径模式（不部署，由主站发布${site.parentSiteId ? '' : '：未设置主站'}）`
}

/** Route map of a site row, tolerating the JSON string the column stores. */
const parseRoutes = (raw: unknown): Record<string, string> => {
  if (raw && typeof raw === 'object') return raw as Record<string, string>
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** The markdown an agent is meant to read end to end before calling anything. */
export async function buildAgentOnboarding(
  db: D1Database,
  input: AgentOnboardingInput
): Promise<string> {
  const sites = await new SitesService(db).list().catch(() => [] as Site[])
  const { results } = await db
    .prepare(
      'SELECT name, display_name, url_prefix FROM collections WHERE is_active = 1 ORDER BY display_name ASC'
    )
    .all()

  const collections = (results ?? []).map((row) => {
    const entry = row as { name: unknown; display_name: unknown; url_prefix: unknown }
    return {
      name: String(entry.name),
      displayName: String(entry.display_name ?? entry.name),
      urlPrefix:
        entry.url_prefix === null || entry.url_prefix === undefined
          ? null
          : String(entry.url_prefix)
    }
  })

  const byId = new Map(sites.map((site) => [site.id, site]))
  const siteLines = sites.map((site) => {
    const prefix =
      site.contentMode === 'paths' && site.parentSiteId
        ? `，主站 ${byId.get(site.parentSiteId)?.slug ?? site.parentSiteId}`
        : ''
    const routes = Object.entries(parseRoutes(site.contentRoutes))
      .map(([collection, path]) => `${collection} → ${path === '' ? '/' : path}`)
      .join('、')
    return `- \`${site.slug}\`（${site.name}）: ${describeMode(site)}${prefix}${routes ? `；集合：${routes}` : ''}`
  })

  const collectionLines = collections.map(
    (collection) =>
      `- \`${collection.name}\`（${collection.displayName}）${collection.urlPrefix === null ? '（不单独路由）' : ` → 前缀 \`${collection.urlPrefix === '' ? '/' : collection.urlPrefix}\``}`
  )

  const examples = [
    `curl -s ${input.baseUrl}/api/collections \\
  -H "Authorization: Bearer ${input.token}"`,
    `curl -s "${input.baseUrl}/api/collections/pages/content?limit=50" \\
  -H "Authorization: Bearer ${input.token}" \\
  -H "X-Site: ${sites[0]?.slug ?? '<site-slug>'}"`,
    `curl -s -X POST ${input.baseUrl}/api/content \\
  -H "Authorization: Bearer ${input.token}" \\
  -H "Content-Type: application/json" \\
  -d '{"collectionId":"<collection-id>","title":"标题","slug":"slug","status":"published","siteIds":["<site-id>"],"data":{"title":"标题","slug":"slug","content":"正文"}}'`,
    `curl -s -X POST ${input.baseUrl}/admin/sync/api/approve-all \\
  -H "Authorization: Bearer ${input.token}"`
  ]

  return `# Sci-Fi CMS · Agent 接入

这个文档是给 AI Agent 用的：它包含这个 CMS 的 API 用法、必须遵守的规则，以及一枚可直接使用的访问令牌。
读完再动手；下面的每条规则都对应一个真实约束，违反它不会报错，只会让内容不生效。

## 1. 连接信息

- CMS 地址：${input.baseUrl}
- 访问令牌：\`${input.token}\`
- 认证方式：每个请求都带上 \`Authorization: Bearer ${input.token}\`
- API 规范（OpenAPI）：\`GET ${input.baseUrl}/api\`
- 后台（人类用）：\`${input.baseUrl}/admin\`
- 版本：${input.version}

### 站点

${siteLines.join('\n') || '- （还没有注册站点）'}

**每个读取内容的请求都要带 \`X-Site: <站点 slug>\`**（或用 \`?site=<slug>\`）。不指定站点时读不到任何内容——内容按站点归属发布，没有“全局可见”这一说。

### 集合

${collectionLines.join('\n') || '- （还没有集合）'}

## 2. 必须先知道的规则

1. **内容归属就是发布控制。** 一条内容发布在 \`siteIds\` 列出的站点上；数组为空 = 不属于任何站点 = **任何站点都读不到**（后台仍能看到它）。要让所有站点都能读到，就把每个站点都列进去。
2. **站点有两种模式。** \`独立模式\` 自己部署、自己发布；\`路径模式\` 不部署，内容由它的「主站」按前缀发布（例如主站发布 \`/blog\`、\`/docs\`）。给路径模式站点写内容时，记得同时归属它的主站，否则主站构建看不到。
3. **网站是静态构建。** 内容进 CMS ≠ 网站立刻更新：站点要重新构建才会体现修改。
4. **后台编辑已发布内容会进入待发布队列（Sync）。** 通过 API 直接 \`PUT /api/content/:id\` 是立即生效的；走后台表单的修改要 \`POST /admin/sync/api/approve-all\` 才生效（该操作会让受影响站点自动重建，返回 \`sitesBuilt\`/\`sitesFailed\`）。
5. **时间戳是毫秒**（\`created_at\`/\`updated_at\`/\`published_at\`）。
6. **\`status\` 取值**：\`draft\` / \`published\`（还有 \`scheduled\`、\`deleted\` 由后台使用）。首次发布时会自动写入 \`published_at\`。
7. **slug 一经发布不可修改**，并且在一个集合内唯一。

## 3. 常用接口

| 用途 | 接口 |
| --- | --- |
| 集合列表（含 \`urlPrefix\`） | \`GET /api/collections\` |
| 某集合的内容 | \`GET /api/collections/:name/content?limit=100\` |
| 单条内容 | \`GET /api/content/:id\` |
| 新建内容 | \`POST /api/content\` |
| 更新内容 | \`PUT /api/content/:id\` |
| 删除内容 | \`DELETE /api/content/:id\` |
| 站点与其发布方式 | \`GET /api/site\`（带 \`X-Site\`）或后台 \`/admin/sites/api/sites\` |
| 触发站点构建 | \`POST /admin/sites/api/sites/:id/build\` |
| 待发布队列 | \`GET /admin/sync/api/pending\`、\`POST /admin/sync/api/approve-all\` |
| 媒体 | \`GET /api/media\`、\`POST /api/media/upload\` |

### 示例

\`\`\`bash
${examples.join('\n\n')}
\`\`\`

\`POST /api/content\` 的字段：\`collectionId\`、\`title\`、\`slug\`（省略则由标题生成）、\`status\`、\`data\`（集合自己的字段，键名见集合的 \`schema\`）、\`siteIds\`（字符串数组，站点 id 或 slug 都可以）。
\`PUT /api/content/:id\` 只更新传了的字段，\`siteIds\` 传了就整体替换。

## 4. 建议的流程

1. \`GET /api/collections\` 拿到集合和它们的 \`urlPrefix\`；后台 \`/admin/sites/api/sites\` 拿到站点 id/slug（这两个接口用同一个令牌即可）。
2. \`GET /api/collections/:name/content\`（带 \`X-Site\`）看现有内容，避免重复创建、也用来照抄 \`data\` 的字段形状。
3. 写内容：\`POST /api/content\` 或 \`PUT /api/content/:id\`，把 \`siteIds\` 写成「该内容应该出现在哪些站点」。
4. 需要让网站更新时：\`POST /admin/sites/api/sites/:id/build\`；如果修改走的是后台表单（进入待发布队列），则 \`POST /admin/sync/api/approve-all\`。
5. 改完读一遍确认：\`GET /api/content/:id\`（带 \`X-Site\`）应该能读到；读不到说明 \`siteIds\` 没包含那个站点。

## 5. 注意

- 这枚令牌拥有全部集合的读写权限，等同 CMS 的写权限；链接泄露即等于凭据泄露。管理员可以在 后台 → Agent 接入 里刷新或吊销它（吊销后这个链接立即失效）。
- 不要把这枚令牌写进公开仓库或前端代码。
- 后台页面有 CSRF 保护，脚本调用请走上面的 \`/api/*\` 与 \`/admin/*/api/*\` 接口，不要模拟表单提交。
`
}
