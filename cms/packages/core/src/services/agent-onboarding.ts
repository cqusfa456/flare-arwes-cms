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
    if (Object.keys(parseRoutes(site.contentRoutes)).length === 0) {
      return '独立模式（发布整个网站）'
    }
    return site.publishesApp ? '独立模式（所列集合 + 框架站）' : '独立模式（只发布所列集合）'
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
  -H "X-API-Key: ${input.token}"`,
    `curl -s "${input.baseUrl}/api/collections/pages/content?limit=50" \\
  -H "X-API-Key: ${input.token}" \\
  -H "X-Site: ${sites[0]?.slug ?? '<site-slug>'}"`,
    `curl -s -X POST ${input.baseUrl}/api/content \\
  -H "X-API-Key: ${input.token}" \\
  -H "Content-Type: application/json" \\
  -d '{"collectionId":"<collection-id>","title":"标题","slug":"slug","status":"published","siteIds":["<site-id>"],"data":{"title":"标题","slug":"slug","content":"正文"}}'`,
    `curl -s -X POST ${input.baseUrl}/admin/sync/api/approve-all \\
  -H "X-API-Key: ${input.token}"`,
    `# 站点接口走后台路由，用 X-API-Key（下面是读站点列表）
curl -s ${input.baseUrl}/admin/sites/api/sites \\
  -H "X-API-Key: ${input.token}"`
  ]

  return `# Sci-Fi CMS · Agent 接入

这个文档是给 AI Agent 用的：它包含这个 CMS 的 API 用法、必须遵守的规则，以及一枚可直接使用的访问令牌。
读完再动手；下面的每条规则都对应一个真实约束，违反它不会报错，只会让内容不生效。

## 1. 连接信息

- CMS 地址：${input.baseUrl}
- 访问令牌：\`${input.token}\`
- 认证方式：**每个请求都带 \`X-API-Key: ${input.token}\`**（内容接口与后台接口都是这个头）。
- 写接口（\`POST\`/\`PUT\`/\`DELETE\`/\`PATCH\`）**只认 \`X-API-Key\`**：把令牌放进 \`Authorization: Bearer\` 会返回 401——那个头是给后台登录会话的 JWT 用的。
- 读内容**必须带 \`X-Site: <站点 slug>\`**（除非令牌本身绑定到某个站点）：不带站点时返回 **0 条**，而不是报错。
- 令牌权限：**读写**（全部集合），并且以创建它的管理员身份调用后台接口——**包括站点管理**。
- 后台（人类用）：\`${input.baseUrl}/admin\`
- 版本：${input.version}

### 站点

${siteLines.join('\n') || '- （还没有注册站点）'}

**每个读取内容的请求都要带 \`X-Site: <站点 slug>\`**（或用 \`?site=<slug>\`）。不指定站点时读不到任何内容——内容按站点归属发布，没有“全局可见”这一说。

### 集合

${collectionLines.join('\n') || '- （还没有集合）'}

## 2. 其他文档地址

这一页只是快速上手；细节按需去读下面这些地址，不必在这一页里全写完。

| 文档 | 地址 | 说明 |
| --- | --- | --- |
| API 参考（最全） | \`${input.baseUrl}/admin/api-reference\` | 逐条列出所有端点的方法、路径、参数与说明（HTML）。后台路由：用 \`X-API-Key: ${input.token}\` 访问，不要用 Cookie。 |
| OpenAPI 规范 | \`${input.baseUrl}/api\` | 机器可读的 OpenAPI 3.0.0（JSON）：核心内容 API 的路径与 schema，适合程序化解析。 |
| 集合与字段定义 | \`GET ${input.baseUrl}/api/collections\` | 每个集合的 \`name\`、\`displayName\`、\`urlPrefix\` 和 \`schema\`（字段名、类型、是否必填）——写 \`data\` 之前先看它。 |
| 系统信息 | \`GET ${input.baseUrl}/api/system/info\` | 名称、版本、能力开关（内容/媒体/缓存/存储后端）。 |
| 健康检查 | \`GET ${input.baseUrl}/api/system/health\` | 数据库、缓存、存储的可用性。 |
| 站点与其发布方式 | \`GET ${input.baseUrl}/api/site\`（带 \`X-Site\`）· \`GET ${input.baseUrl}/admin/sites/api/sites\` | 站点模式、主站、内容路由。 |
| 站点管理（增删改） | \`POST ${input.baseUrl}/admin/sites/api/sites\`、\`PATCH\` / \`DELETE ${input.baseUrl}/admin/sites/api/sites/:id\` | 注册站点、改名称/模式/主站/内容路由、注销站点。后台路由：用 \`X-API-Key\` 调用。 |
| 站点构建 / 部署记录 | \`POST ${input.baseUrl}/admin/sites/api/sites/:id/build\`、\`GET .../deployments\` | 触发构建（路径模式站点会被拒绝，要构建它的主站）并查看最近的部署。 |
| 构建配置 / 环境变量 | \`POST ${input.baseUrl}/admin/sites/api/sites/:id/sync-build-config\`、\`POST .../build-env\` | 把构建配置与构建环境推送到 Cloudflare。 |
| 站点域名 | \`POST ${input.baseUrl}/admin/sites/api/sites/:id/domains\`、\`DELETE .../domains/:hostname\`、\`POST .../domains/refresh\`、\`POST .../domains/primary\`、\`POST .../domains/dns\` | 绑定、解绑、刷新自定义域名；\`domains/dns\` 会创建/核对把该域名指向本站的 DNS 记录（传 \`{"takeOver":true}\` 才会接管一个已指向别处的同名记录）。 |
| 站点预设 | \`GET ${input.baseUrl}/admin/sites/api/presets\`、\`POST .../presets/import\` | Arwes 预设与一键导入。 |
| 待发布队列 | \`GET ${input.baseUrl}/admin/sync/api/pending\` | 后台编辑产生的待发布修订（含 diff）。 |

调用这些地址时同样带上令牌：**一律用 \`X-API-Key: ${input.token}\`**（\`/api/*\` 的读接口不校验身份，但只有带上它才会按站点返回内容；\`/api/*\` 的写接口和 \`/admin/*\` 都必须用它）。\`Authorization: Bearer\` 只用于后台登录会话的 JWT。

## 3. 必须先知道的规则

1. **内容归属就是发布控制。** 一条内容发布在 \`siteIds\` 列出的站点上；数组为空 = 不属于任何站点 = **任何站点都读不到**（后台仍能看到它）。要让所有站点都能读到，就把每个站点都列进去。
2. **站点有两种模式。** \`独立模式\` 自己部署、自己发布；\`路径模式\` 不部署，内容由它的「主站」按前缀发布（例如主站发布 \`/blog\`、\`/docs\`）。给路径模式站点写内容时，记得同时归属它的主站，否则主站构建看不到。
   独立模式的站点还可以开启「**同时发布框架站**」（\`publishesApp\`）：这样它除了自己的集合，还会发布网站自身的路由（首页、\`/demos\`、\`/docs\` 下的框架文档）；路由到 \`""\` 的集合仍然占用域名根目录，所以文档站是「根目录放文档、\`/docs\` 放框架文档」。
3. **网站是静态构建。** 内容进 CMS ≠ 网站立刻更新：站点要重新构建才会体现修改。
4. **后台编辑已发布内容会进入待发布队列（Sync）。** 通过 API 直接 \`PUT /api/content/:id\` 是立即生效的；走后台表单的修改要 \`POST /admin/sync/api/approve-all\` 才生效（该操作会让受影响站点自动重建，返回 \`sitesBuilt\`/\`sitesFailed\`）。
5. **时间戳是毫秒**（\`created_at\`/\`updated_at\`/\`published_at\`）。
6. **\`status\` 取值**：\`draft\` / \`published\`（还有 \`scheduled\`、\`deleted\` 由后台使用）。首次发布时会自动写入 \`published_at\`。
7. **slug 一经发布不可修改**，并且在一个集合内唯一。

## 4. 常用接口（速查）

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

## 5. 建议的流程

1. \`GET /api/collections\` 拿到集合和它们的 \`urlPrefix\`；后台 \`/admin/sites/api/sites\` 拿到站点 id/slug（这两个接口用同一个令牌即可）。
2. \`GET /api/collections/:name/content\`（带 \`X-Site\`）看现有内容，避免重复创建、也用来照抄 \`data\` 的字段形状。
3. 写内容：\`POST /api/content\` 或 \`PUT /api/content/:id\`，把 \`siteIds\` 写成「该内容应该出现在哪些站点」（读完再用带 \`X-Site\` 的读接口核对）。
4. 需要让网站更新时：\`POST /admin/sites/api/sites/:id/build\`；如果修改走的是后台表单（进入待发布队列），则 \`POST /admin/sync/api/approve-all\`。
5. 改完读一遍确认：\`GET /api/content/:id\`（带 \`X-Site\`）应该能读到；读不到说明 \`siteIds\` 没包含那个站点。

## 6. 注意

- 这枚令牌是**读写令牌**，权限等同创建它的管理员（含站点管理）；链接泄露即等于凭据泄露。管理员可以在 后台 → Agent 接入 里刷新或吊销它（吊销后这个链接立即失效）。
- 只读令牌（可在 后台 → API 令牌 里创建）只允许 GET：任何写操作都会返回 403。
- 不要把这枚令牌写进公开仓库或前端代码。
- 后台页面有 CSRF 保护，脚本调用请走上面的 \`/api/*\` 与 \`/admin/*/api/*\` 接口，不要模拟表单提交。
`
}
