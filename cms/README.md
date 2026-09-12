# Flare CMS 集成

本项目集成了 [Flare CMS](https://flare-site.pages.dev/) —— 一个运行在 Cloudflare Workers 上的 Astro-first headless CMS，用于管理网页内容。

## 架构

```
cms/                    Flare CMS 后端 (Cloudflare Worker)
  packages/core/        @flare-cms/core — 引擎 (schema, services, routes)
  packages/cms/         @flare-cms/cms — Cloudflare Worker 应用
  packages/astro/       @flare-cms/astro — Astro Content Layer loader

apps/docs/              Astro 前端
  src/content.config.ts 定义 pages 集合，构建时从 CMS 拉取内容
  src/pages/[...path].astro 生成静态页面 (应用路由 + CMS 页面)
  src/cms/CmsPage.tsx   CMS 页面渲染组件
```

## 工作流程

1. **内容管理**：在 Flare CMS Admin (`http://localhost:8787/admin`) 中创建/编辑页面
2. **构建**：`astro build` 时 `flareLoader` 从 CMS API 拉取 `pages` 集合内容
3. **渲染**：CMS 页面的 markdown 内容在构建时渲染为 HTML，生成静态页面
4. **导航**：CMS 页面不在客户端路由表中，点击时整页跳转（内容仅 SSR 可用）

## 本地开发

### 1. 启动 Flare CMS

```bash
# 首次：安装依赖 + 构建
cd cms
pnpm install
pnpm build          # 构建 @flare-cms/core
pnpm build:astro    # 构建 @flare-cms/astro

# 首次：本地数据库迁移 + 创建管理员
cd packages/cms
echo "JWT_SECRET=local-dev-secret" > .dev.vars
npx wrangler d1 migrations apply DB --local
npx tsx scripts/seed-admin.ts   # 或通过 /auth/register 注册第一个用户

# 启动 CMS (http://localhost:8787, Admin: /admin)
npx wrangler dev --local --port 8787
```

或使用根目录脚本：

```bash
sh ./scripts/cms.sh dev
```

### 2. 启动前端

```bash
cd apps/docs
npm run dev   # http://localhost:9002
```

构建时 `flareLoader` 会从 `http://localhost:8787` 拉取内容（可通过 `PUBLIC_FLARE_API_URL` 环境变量覆盖）。

## 内容管理

### 创建页面

1. 打开 `http://localhost:8787/admin` 登录
2. 进入 **Pages** 集合 → **New Content**
3. 填写：
   - **Title**: 页面标题
   - **Slug**: URL 路径（如 `about` → `/about`）
   - **Content**: Markdown 内容
   - **Meta Description**: SEO 描述（可选）
4. 保存并 **Publish**

### 发布流程

- 内容默认状态为 `draft`，只有 `published` 的内容会被 `flareLoader` 拉取
- 修改内容后重新构建前端即可生效

## 部署

### 1. 部署 CMS 到 Cloudflare

```bash
cd cms/packages/cms
npx wrangler login
npx wrangler d1 create arwes-cms-db        # 创建 D1 数据库
npx wrangler r2 bucket create arwes-cms-media  # 创建 R2 存储
# 更新 wrangler.toml 中的 database_id / bucket_name
npx wrangler secret put JWT_SECRET --env production
npx wrangler d1 migrations apply DB --env production
npx wrangler deploy --env production
```

### 2. 前端构建时连接远程 CMS

```bash
PUBLIC_FLARE_API_URL=https://your-worker.workers.dev \
PUBLIC_FLARE_API_TOKEN=st_xxx \
npm run build
```

## 存储后端

媒体存储支持三种 provider，由 `STORAGE_BACKEND` 单一开关选择。三者共用同一套
`StorageBucket` 接口（`head` / `get` / `put` / `delete`），因此上传、下载、删除与
`/files/*` 静态服务对 provider 完全无感：

| `STORAGE_BACKEND`     | Provider                              | 配置                                                                                     |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| 未设置 / `r2`         | Cloudflare R2                         | `MEDIA_BUCKET` R2 binding                                                                |
| `b2`                  | Backblaze B2                          | `B2_BUCKET` / `B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY`（可选 `B2_ENDPOINT`、`B2_REGION`） |
| `s3`                  | 通用 S3 兼容（AWS S3 / MinIO / Wasabi） | `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`（可选 `S3_ENDPOINT`、`S3_REGION`、`S3_FORCE_PATH_STYLE`） |

### Cloudflare R2（默认）

使用 `MEDIA_BUCKET` R2 binding，无需额外配置。

### Backblaze B2（私有桶）

使用私有 B2 桶替代 R2，通过 S3 兼容 API + AWS Signature V4 访问：

1. 在 [Backblaze B2](https://secure.backblaze.com/b2_buckets.htm) 创建**私有**桶
2. 创建 Application Key（`B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY`）
3. 在 `wrangler.toml` 的 `[vars]` 中配置：

```toml
STORAGE_BACKEND = "b2"
B2_ENDPOINT = "https://s3.us-west-004.backblazeb2.com"  # 可选：桶所在区域
B2_BUCKET = "arwes-cms-media"                            # 私有桶名
B2_ACCESS_KEY_ID = "..."
B2_SECRET_ACCESS_KEY = "..."
B2_REGION = "us-west-004"
```

### 通用 S3 兼容（AWS S3 / MinIO / Wasabi / R2 S3 API）

```toml
STORAGE_BACKEND = "s3"
S3_BUCKET = "arwes-cms-media"
S3_ACCESS_KEY_ID = "..."
S3_SECRET_ACCESS_KEY = "..."
# 可选：省略时按 S3_REGION 推导为 https://s3.<region>.amazonaws.com
S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com"
S3_REGION = "us-east-1"
# 默认 true（MinIO/B2 需要）；AWS 可设为 "false" 使用 virtual-hosted 寻址
S3_FORCE_PATH_STYLE = "true"
```

本地开发时把同样的变量加到 `packages/cms/.dev.vars`，并移除 `wrangler.toml` 中的
`[[r2_buckets]]` 块（部署时 `scripts/storage-config.py` 会自动移除）。

### 行为说明

- **不回退**：所选 provider 缺少必填变量时，Worker 仍然启动但请求会返回 500，
  并明确列出缺失的变量名 —— 不会悄悄继续用 R2。这也是排查"为什么还在用 R2"的关键。
- **scheduled 一致**：cron 定时任务与 HTTP 请求走同一套 provider 解析。
- **Admin 可见**：`GET /api/system/health` 返回 `checks.storage.provider`，
  Admin → Settings → Storage 只读展示当前 provider（bucket / endpoint / region /
  寻址方式），并提供"Test connection"自检（`POST /admin/settings/storage/test`）。
- 实现位于 `packages/core/src/storage/`：`resolveStorage()` 是唯一的决策点，
  `S3Storage` 是通用适配器。`packages/cms/src/storage/b2-storage.ts` 现为转发垫片。

## 站点控制面（Sites）

CMS 是所有网站的**唯一控制面**：站点的构建、域名绑定与内容归属都在 Admin → Sites 里管理，
不再需要为每个站点写一份 GitHub Actions 构建流程。

数据模型（迁移 `038_sites_registry.sql`）：

- `sites` — 站点注册表：slug、Cloudflare Pages 项目、Git 仓库/分支、Deploy Hook、
  构建命令 / 输出目录 / 根目录 / Node 版本、内容前缀、启用状态、最近构建结果
- `site_domains` — 自定义域名绑定及其校验状态（`pending` / `active` / `error` / `removed`）
- `content.site_id` — 内容归属；`NULL` 表示共享内容，所有站点可读

能做什么：

| 操作 | 实现 |
|------|------|
| **构建站点** | `POST` 该站点的 Deploy Hook（Pages 或 Workers Builds，按 provider）。构建由 Cloudflare 执行，CMS 只触发并回显结果 |
| **管理构建配置** | Pages：`PATCH` 项目 `build_config`；Worker：`PATCH` Workers Builds trigger（build/deploy command + root directory） |
| **绑定域名** | 按 provider 调用对应 API：Pages `POST /pages/projects/{p}/domains`；Worker `PUT /workers/domains`（需 zone） |
| **从云端刷新** | 采纳在 Cloudflare 控制台手工添加的域名；云端已消失的标记为 `removed` |
| **指定主域名** | 标记某个已激活域名为该站点的 canonical 域名 |
| **查看部署** | Pages：最近部署（环境/stage/状态/URL）；Worker：Workers Builds 构建记录 |

### 托管 provider

`sites.provider` 决定用哪套 Cloudflare API：
| `provider` | 托管 | 域名 API | 构建配置 | 触发 |
| ---------- | ---- | -------- | -------- | ---- |
| `cloudflare-worker`（推荐多站点） | Worker + 静态资源 | `/workers/domains`（**必须带 zone**） | Workers Builds trigger | `/workers/builds/deploy_hooks/{id}` |
| `cloudflare-pages` | Pages 项目 | `/pages/projects/{p}/domains` | 项目 `build_config` | `/pages/webhooks/deploy_hooks/{id}` |
| `external` | 仅登记 | — | — | — |

要点：

- **一个 Worker 可挂多个自定义域名**，所以多站点部署用 Worker 比"每站点一个 Pages 项目"更省事
- Worker 域名**必须属于某个 zone**：CMS 自动按**最长后缀**匹配 token 可见的 zone，也可在站点上固定 `cfZoneId`；匹配不到会明确报错
- Worker 域名由 Cloudflare 自动建 DNS + 签发证书，绑定成功即 `active`；Pages 域名需要你自己指 DNS，所以先 `pending`
- **删除 Worker 域名不会删除自动签发的证书**，需在 SSL/TLS → Edge Certificates 另外清理
- Workers Builds 用不可变的 **Worker tag** 寻址（首次自动解析并缓存）；构建配置在 **trigger** 上（按分支挑选并缓存）
- Deploy Hook 串用会被拒绝（Worker 站点填 Pages hook 直接报错），因为两者返回结构不同（`{id,url}` vs `{result:{build_uuid}}`）
- Builds 在已有排队构建时返回同一构建 + `already_exists: true`，CMS 视为成功

### 凭据权限

| 场景 | token 权限 |
| ---- | ---------- |
| Pages 站点 | `Pages:Edit`、`Zone:Read` |
| Worker 站点 | 额外需要 `Workers Scripts:Read`（解析 tag）、`Workers CI:Edit`（即 Workers Builds） |

Builds API **只接受 user-scoped token**（account-scoped 会返回 "Invalid token"）。CMS 会在该错误上补一句提示，避免误判成 token 写错。

#### 一键生成 token

Cloudflare 支持把权限预填进 token 创建页的 URL，所以不需要手工勾选十几个权限行：

```powershell
# CI token（写入 GitHub secret CF_API_TOKEN）—— 打开页面 → 点两下 → 粘贴回来
node scripts/set-cf-token.mjs
```

脚本会：打印并打开已预填权限的页面 → 列出需要在页面上核对的权限 → 让你粘贴 token →
**先用 `/user/tokens/verify` 校验，通过后才写入 secret**（校验失败不写入任何东西）→
只改 `CF_API_TOKEN`（账号唯一时顺带 `CF_ACCOUNT_ID`），不碰 `JWT_SECRET` 等其他 secret。

`npm run setup`（OpenTUI 向导）里的 Cloudflare 面板也走同一套流程，并会显示同样的权限核对清单。
权限模板定义在 `scripts/lib/cf-token-template.mjs`（含 `ci` 与 `runtime` 两套）。

> ⚠️ **不要用 OAuth token 当 `CF_API_TOKEN`。** OAuth access token 只有 **1 小时**寿命，
> 这是部署流水线每小时失败一次（`Invalid access token [code: 9109]`）的原因。
> 向导里的 OAuth 登录只用在本会话内执行 wrangler 命令，不再写入 secret。

凭据：Worker secrets `CF_API_TOKEN` / `CF_ACCOUNT_ID` 优先，未设置时回落到 D1 设置
（可在 Admin → Sites 页面底部保存，便于轮换而无需重新部署）。

- **部署 workflow 会自动装好这两个 secret**：`.github/workflows/deploy.yml` 里有一步
  `wrangler secret put`，优先使用专用的 GitHub secret **`CF_SITES_API_TOKEN`**（用
  `node scripts/set-cf-token.mjs runtime` 生成，权限最小：Workers Scripts:Read、Zone:Read、
  Workers Routes:Edit、Workers CI:Edit(=Builds)、Pages:Edit），未设置时回落到 CI 的
  `CF_API_TOKEN` 并打印告警。所以不需要手工 `wrangler secret put`
- API token 永不返回给客户端；Deploy Hook URL（能力型 URL）与构建 token 在 JSON 响应中被掩码

### 从 CMS 注册与构建一个站点

Admin → Sites 按**托管类型分组**展示（Worker / Pages / External），并可一键导入 **Arwes 预设**
（`apps/docs` 的构建约定已内置，含 `{{slug}}` 占位替换，新增 Astro 应用只需加一条预设）。

**Worker 站点（推荐：一个 Worker 可绑定多个域名）**

1. 在 Cloudflare 把 Worker **连接 Git 仓库**（Worker → Settings → Builds），使其存在一个 trigger
2. 在 CMS 注册站点：名称、slug、Worker 名（**不是** tag）、Git 仓库/分支，以及 build / deploy
   命令与 root directory（预设已填好）：
   - `build_command`：`sh ./apps/docs/scripts/build-worker.sh`
   - `deploy_command`：`cd apps/docs && ../../cms/packages/cms/node_modules/.bin/wrangler deploy`
   - `root_directory`：`/`
3. 点 **Push build config + env**：CMS 下发上述构建设置，并把构建期环境变量写入该 trigger：
   `PUBLIC_FLARE_API_URL`（CMS 自身地址）、`PUBLIC_FLARE_SITE`（站点 slug）、
   `PUBLIC_FLARE_API_TOKEN`（CMS 自动签发的**只读、限定该站点**的 token）。
   站点可在 Site settings 里用同名变量覆盖任意一个
4. 点 **Build now**：Worker 站点直接走 Workers Builds API
   （`POST /accounts/{id}/builds/triggers/{uuid}/builds`），**不再需要 Deploy Hook**；
   "Build via Deploy Hook" 作为兜底入口。Pages 站点仍只能用 Deploy Hook
5. **Bind domain**：Worker 自定义域名必须落在 token 可见的 zone 内（可在站点上固定 zone id）

**Pages 站点**

1. Pages 项目必须是 **Git 连接**的（Direct Upload 项目无法被 Deploy Hook 重建）
2. 设置构建命令 / 输出目录 / root 目录（可由 CMS 下发）。Pages 的构建变量在项目自己的设置里，
   CMS 不下发
3. 创建 **Deploy Hook** 填入站点，再 **Bind domain**

**四种部署模式**（`sites.deploy_mode`，留空则按 provider 取默认）

| 模式 | 谁执行构建 | 需要什么 | 适用 |
| --- | --- | --- | --- |
| `workers-builds` | Cloudflare（从 Git 连接） | Worker 已连 Git 仓库并存在 trigger | 默认（Worker），CMS 能下发构建环境变量 |
| `github-actions` | GitHub Actions（CMS dispatch） | 已保存 GitHub 仓库 + token | **Cloudflare 侧不连 Git**；Worker 直传或 Pages Direct Upload |
| `deploy-hook` | Cloudflare（Pages 项目自行构建） | Deploy Hook URL | 默认（Pages），项目已连 Git |
| `direct-upload` | 你自己 | 本地构建后 `wrangler deploy` | CMS 只登记，不触发 |

**`github-actions` 模式（推荐用于"不在 Cloudflare 连 Git"）**

1. 生成一个**细粒度 PAT**：仅本仓库，权限 **Actions: write**（经典 token 则需 `workflow` scope）
2. 在 **Admin → Sites → GitHub deploy** 卡片填入仓库（`owner/name`）与 token
   （也可用 Worker secret `GITHUB_TOKEN` / `GITHUB_REPO`，或复用旧的 `/admin/deploy/api/settings`）
3. 站点详情的按钮变成 **Deploy via GitHub Actions**：CMS 会 dispatch
   `.github/workflows/deploy-site.yml`，并把**该站点自己的** build/deploy 命令、root directory、slug 作为输入传过去
   （仓库始终是唯一真源，工作流本身与站点无关）
4. 工作流在 runner 上跑 `build_command`，再跑 `deploy_command` 直传：
   - Worker：`cd apps/docs && ../../cms/packages/cms/node_modules/.bin/wrangler deploy`
   - Pages：`wrangler pages deploy apps/docs/build --project-name="$PAGES_PROJECT" --branch="$DEPLOY_BRANCH"`
     （Direct Upload，同样不需要 Cloudflare 连 Git；**Pages 项目不需要手动预建**——工作流会用
     `wrangler pages project create` 幂等创建，只容忍 "already exists"，鉴权失败会立刻报错并给出提示；
     `$PAGES_PROJECT`/`$DEPLOY_BRANCH` 由工作流注入；Pages 自定义域名/子域名绑定不需要 zone。
     **前提：`CF_API_TOKEN` 必须有 `Pages: Edit`（account 级）**——只有 Workers 权限的 token 会在 Pages API 上返回
     `Authentication error [code: 10000]`（实测：同一个 token 部署 Worker 成功、部署 Pages 失败）。
     `node scripts/set-cf-token.mjs` 生成的 token 已包含该权限，重新生成并更新 secret 即可。
     另注意 `$DEPLOY_BRANCH` 必须与项目的 production branch 一致，否则 Pages 会记成 preview 部署）

构建期内容：工作流注入 `PUBLIC_FLARE_API_URL`（来自 GitHub secret `FLARE_API_URL`）+ `PUBLIC_FLARE_SITE`（站点 slug）。
**内容 API 对已发布内容是公开的**（按 `X-Site` 隔离），所以不需要额外的 CMS API token；若提供 token 则必须有效（无效会被 401 拒绝）。

**不想连 Git？（Direct Upload）**

Cloudflare **不能在 Worker 里构建你的站点**：Workers Builds 本身就是 Git 集成（GitHub/GitLab），而
Worker 运行时没有 Node 工具链、没有可写文件系统，跑不了 `astro build`。所以"不用 GitHub"的正确形态是
**Direct Upload** —— 在本地（或任意 CI/容器）构建，再把产物直接推成新版本。`wrangler deploy` 内部走的
就是这套 API（提交 manifest → 上传文件 → 带 `assets.jwt` 部署三步），Cloudflare 侧不需要任何 Git 连接：

```sh
cd apps/docs && npm run worker:build && npm run worker:deploy
```

这种模式下 CMS 负责**域名、内容与登记**：站点照常注册为 `cloudflare-worker`，域名绑定/内容隔离都能用；
构建按钮会明确告诉你"没有 trigger 就本地 direct upload"，而不是把你往 Git 上逼。

> 真正"让 Cloudflare 自己构建、且不连 Git"只有一条路：**Containers**（`@cloudflare/sandbox`，
> 在容器里跑构建，由 Worker 驱动），需要付费计划，属于另一个量级的工作。

> 以上构建/域名动作需要 `CF_API_TOKEN` / `CF_ACCOUNT_ID`。未配置时注册站点、内容归属与
> 域名记录仍可用，但构建触发与域名绑定会明确报错而不是静默失败。Builds API 要求
> **user-scoped** token 并带 `Workers Builds Configuration: Edit`。

### 代码位置

- `packages/core/src/services/sites.ts` — 注册表 + Cloudflare 客户端 + 构建/域名/构建环境逻辑
- `packages/core/src/services/site-providers.ts` — 托管类型元数据（标签、字段、能力矩阵）
- `packages/core/src/services/site-presets.ts` — Arwes 站点预设与 `{{slug}}` 替换
- `packages/core/src/routes/admin-sites.ts` — 页面 + JSON API（`/admin/sites`）
- `packages/core/src/templates/pages/admin-sites.template.ts` — 列表 / 新建 / 详情页

### 按站点隔离内容

`content.site_id` 决定归属：`NULL` = **共享内容**（所有站点可读），否则只属于该站点。
读取时服务端强制加作用域（`packages/core/src/services/content-site-scope.ts`）：

| 请求方 | 可见内容 |
| ------ | -------- |
| `X-Site: <slug\|id>` 或 `?site=<slug\|id>`（活跃站点） | 该站点内容 + 共享内容 |
| 使用**绑定站点的 API token**（`api_tokens.site_id`） | 固定为该站点内容 + 共享内容，**忽略** `X-Site`（构建 token 读不到别的站点） |
| 未标示站点，但部署里已注册了站点 | **仅共享内容** |
| 未标示站点，且没有任何站点 | 全部内容（单租户，向后兼容） |
| 标示了不存在/已停用的站点 | **404**（明确报错，而不是静默空列表） |

- 作用域通过 `QueryFilter.internalAnd` 注入，`parseFromQuery` 永远不会产生该字段，因此**调用方无法放宽**作用域；站点 id 取自数据库查询
- 作用域是 `filter` 的一部分，因此**参与 API 缓存 key**，一个站点不会命中另一个站点的缓存
- 写入：`POST /api/content` 支持 `siteId`（id）或 `site`（slug）；不传则创建共享内容；站点不存在返回 400
- **后台归属**：Admin → Content 的新建/编辑表单有 **Site 选择器**（"Shared — visible to every site" 或某个站点）。
  未注册任何站点时整块隐藏，单租户部署表单保持原样；复制内容继承原内容的站点
- **不会误清空**：更新路径只在表单确实提交了 `site_id` 时改写归属，所以没有渲染该字段的表单（例如校验失败回显）不会把归属静默清空
- 响应 `meta.siteScope` 回显 `{ mode, siteSlug, identifiedBy, reason }`，便于排查空构建

**构建端接入**（`@flare-cms/astro`）：

```ts
flareLoader({
  apiUrl: API_URL,
  site: import.meta.env.PUBLIC_FLARE_SITE,  // 站点 slug，发送 X-Site
  collection: 'pages',
})
```

未设置 `site` 且部署中已注册站点时，loader 会打印告警并按「仅共享内容」处理。
`apps/docs` 已接入 `PUBLIC_FLARE_SITE` 环境变量。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PUBLIC_FLARE_API_URL` | CMS API 地址（Worker 站点由 CMS 下发到 trigger，可被站点覆盖） | `http://localhost:8787` |
| `PUBLIC_FLARE_API_TOKEN` | 只读 API token（Worker 站点由 CMS 自动签发并下发） | 无 |
| `PUBLIC_FLARE_SITE` | 站点 slug，按站点隔离内容时必填（Worker 站点由 CMS 下发） | 无 |
| `FLARE_API_URL` | （可选，Worker 变量）站点未固定 `PUBLIC_FLARE_API_URL` 时，CMS 用它作为下发的地址 | 请求来源 origin |
| `CF_API_TOKEN` / `CF_ACCOUNT_ID` | （Worker secret，可选）站点域名管理所需的 Cloudflare API 凭据 | 无 |

## 注意事项

- `@flare-cms/astro` 通过 `file:` 协议从 `cms/packages/astro` 安装，修改源码后需重新构建（`pnpm build:astro`）
- Flare CMS 的 API token 是只读的，写操作需通过 Admin UI 或用户 JWT
- 本地 wrangler 的 KV 缓存可能导致内容更新后 API 返回旧数据，重启 wrangler 或清除 `.wrangler/state` 可解决
