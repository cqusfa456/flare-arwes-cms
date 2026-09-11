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

Flare CMS 支持两种媒体存储后端：

### Cloudflare R2（默认）

使用 `MEDIA_BUCKET` R2 binding，无需额外配置。

### Backblaze B2（私有桶）

使用私有 B2 桶替代 R2，通过 S3 兼容 API + AWS Signature V4 访问：

1. 在 [Backblaze B2](https://secure.backblaze.com/b2_buckets.htm) 创建**私有**桶
2. 创建 Application Key（`B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY`）
3. 在 `wrangler.toml` 的 `[vars]` 中配置：

```toml
STORAGE_BACKEND = "b2"
B2_ENDPOINT = "https://s3.us-west-004.backblazeb2.com"  # 桶所在区域
B2_BUCKET = "arwes-cms-media"                            # 私有桶名
B2_ACCESS_KEY_ID = "..."
B2_SECRET_ACCESS_KEY = "..."
B2_REGION = "us-west-004"
```

本地开发时把同样的变量加到 `packages/cms/.dev.vars`。

B2 适配器（`packages/cms/src/storage/b2-storage.ts`）实现了 R2Bucket 兼容接口
（put/get/head/delete + writeHttpMetadata），所有媒体上传/下载/删除自动走 B2。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PUBLIC_FLARE_API_URL` | CMS API 地址 | `http://localhost:8787` |
| `PUBLIC_FLARE_API_TOKEN` | 只读 API token（可选） | 无 |

## 注意事项

- `@flare-cms/astro` 通过 `file:` 协议从 `cms/packages/astro` 安装，修改源码后需重新构建（`pnpm build:astro`）
- Flare CMS 的 API token 是只读的，写操作需通过 Admin UI 或用户 JWT
- 本地 wrangler 的 KV 缓存可能导致内容更新后 API 返回旧数据，重启 wrangler 或清除 `.wrangler/state` 可解决
