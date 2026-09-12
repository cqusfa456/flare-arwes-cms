<!-- markdownlint-disable MD033 MD013 MD028 -->

# ARWES × Flare CMS 功能总览

本文件详细介绍本项目的全部功能与特性，覆盖 **ARWES 框架**、**Flare CMS 内容管理**、**前端应用**、**运维部署** 四个层面。

---

## 目录

- [1. 项目定位](#1-项目定位)
- [2. ARWES 科幻 UI 框架](#2-arwes-科幻-ui-框架)
  - [2.1 动画系统 (animated/animator)](#21-动画系统)
  - [2.2 动态背景 (bgs)](#22-动态背景)
  - [2.3 音效系统 (bleeps)](#23-音效系统)
  - [2.4 特效 (effects)](#24-特效)
  - [2.5 科幻边框 (frames)](#25-科幻边框)
  - [2.6 文字动画 (text)](#26-文字动画)
  - [2.7 主题系统 (theme)](#27-主题系统)
  - [2.8 工具库 (tools)](#28-工具库)
  - [2.9 React 绑定](#29-react-绑定)
  - [2.10 Solid 绑定](#210-solid-绑定)
- [3. Flare CMS 内容管理系统](#3-flare-cms-内容管理系统)
  - [3.1 CMS Worker](#31-cms-worker)
  - [3.2 Collections 集合系统](#32-collections-集合系统)
  - [3.3 Admin 管理后台](#33-admin-管理后台)
  - [3.4 存储后端：R2 与 Backblaze B2](#34-存储后端)
  - [3.5 Astro 内容加载器](#35-astro-内容加载器)
  - [3.6 认证与 API Tokens](#36-认证与-api-tokens)
  - [3.7 站点控制面 (Sites)](#37-站点控制面sites)
    - [3.7.1 两种托管 provider](#371-两种托管-provider)
    - [3.7.2 按站点隔离内容](#372-按站点隔离内容)
- [4. 前端应用](#4-前端应用)
  - [4.1 文档站 (apps/docs)](#41-文档站)
  - [4.2 沙盒 (apps/play)](#42-沙盒)
  - [4.3 性能测试 (apps/perf)](#43-性能测试)
- [5. 运维与部署](#5-运维与部署)
  - [5.1 GitHub Actions 自动部署](#51-github-actions-自动部署)
  - [5.2 初始化 TUI 向导](#52-初始化-tui-向导)
  - [5.3 OAuth 登录脚本](#53-oauth-登录脚本)
  - [5.4 GitHub Secrets 管理](#54-github-secrets-管理)
  - [5.5 B2 部署配置脚本](#55-b2-部署配置脚本)
  - [5.6 本地开发脚本](#56-本地开发脚本)
- [6. 架构图](#6-架构图)
- [7. 技术栈汇总](#7-技术栈汇总)

---

## 1. 项目定位

本项目是 [ARWES](https://arwes.dev) 科幻风格 UI 框架的完整工程化实现，包含：

- **ARWES 框架内核**：23 个 TypeScript 包，提供动画、音效、科幻边框、动态背景、文字特效等
- **Flare CMS**：自建 headless CMS（Cloudflare Worker），驱动内容管理
- **Astro 7 文档站**：静态优先 + React islands + Tailwind
- **Cloudflare 边缘部署**：Workers + Pages + D1 + KV + (R2/B2)

核心理念：_Futuristic Sci-Fi UI Web Framework_，受 Cyberprep、Star Citizen、Halo 等科幻作品启发。

---

## 2. ARWES 科幻 UI 框架

### 2.1 动画系统

**`@arwes/animated`** — 低层动画引擎

- `createAnimation`：基于 requestAnimationFrame 的动画实例（duration、easing、repeat、direction）
- `createAnimatedElement`：将动画绑定到 DOM 元素，支持进入/退出状态机
- `transition` / `fade` / `flicker` / `draw`：预设动画过渡
- `easing`：缓动函数库（inSine、outExpo 等）
- `easeAmong` / `easeSteps`：多段缓动工具

**`@arwes/animator`** — 动画状态机

- `createAnimatorSystem`：动画节点树，管理父子节点状态传播
- 状态流转：`exited → entering → entered → exiting → exited`
- 支持：禁用、静音、刷新、递归控制

**`@arwes/react-animator`** — React 绑定

- `<Animator>`：声明式动画节点，props 包括 `active`、`disabled`、`unmountOnExited`、`merge`、`combine`、`manager`（`sequence`/`stagger`/`switch`）等
- `<AnimatorGeneralProvider>`：全局动画设置
- `useAnimator`：hook 访问动画节点

### 2.2 动态背景

**`@arwes/bgs`** — 背景画布生成器

- `createBackgroundDots`：点阵背景
- `createBackgroundPuffs`：粒子团背景（如星云）
- `createBackgroundGridLines`：网格线背景
- `createBackgroundMovingLines`：移动线条背景

**`@arwes/react-bgs`** — React 组件

- `<Dots>` / `<Puffs>` / `<GridLines>` / `<MovingLines>`
- 支持颜色、尺寸、间距、透明度、动画属性配置

### 2.3 音效系统

**`@arwes/bleeps`** — 音频管理引擎

- `createBleep`：单个音效（基于 Web Audio API，支持播放、循环、淡入淡出）
- `createBleepsManager`：音效管理器，按分类组织（background / transition / interaction / notification）
- 支持类别音量、主音量、窗口失焦静音（`muteOnWindowBlur`）

**`@arwes/react-bleeps`** — React 绑定

- `<BleepsProvider>`：全局音效上下文（master / categories / bleeps 配置）
- `useBleeps`：hook 获取命名音效并触发播放
- `<BleepsOnAnimator>`：在动画状态变化时自动播放音效

### 2.4 特效

**`@arwes/effects` / `@arwes/react-effects`**

- `createEffectIlluminator` / `createEffectIlluminatorSVG`：光照扫描特效
- React 组件 `<Illuminator>` / `<IlluminatorSVG>`：鼠标跟随光晕，营造科幻界面质感

### 2.5 科幻边框

**`@arwes/frames`** — 边框生成器

- `createFrame`：基础边框（HTML/SVG）
- `createFrameUnderlineSettings`：下划线边框
- `createFrameLinesSettings`：平行线边框
- `createFrameCornersSettings`：边角括号边框
- `createFrameOctagonSettings`：八角形切割边框

**`@arwes/react-frames`** — React 组件

- `<FrameOctagon>` / `<FrameUnderline>` / `<FrameCorners>` / `<FrameKranox>` / `<FrameNero>` / `<FrameHexagon>` / `<FrameLines>` / `<FrameHeader>` / `<FrameBox>` / `<FrameAphex>` / `<FramePentagon>` / `<FrameHoneycomb>` / `<FrameDiamonds>` / `<FrameStar>` 等
- 支持大小、线条宽度、颜色、切割尺寸、动画

### 2.6 文字动画

**`@arwes/text`** — 文字渲染引擎

- `animateTextSequence`：逐字显示/清除动画
- `animateTextDecipher`：密文解密式显示（字符乱码 → 真实内容）
- `getAnimationTextDuration`：按文本长度计算动画时长

**`@arwes/react-text`** — React 组件

- `<Text>`：声明式文字动画组件，支持 `manager`（`sequence`/`decipher`）、`fixed`、`blink`、`characters` 等

### 2.7 主题系统

**`@arwes/theme`** — 主题工具

- `createThemeMultiplier`：倍数函数
- `createThemeUnit`：单位函数（如 `space(2)` → `0.5rem`）
- `createThemeColor`：调色板（13 阶色阶：low/main/high）
- `createThemeStyle`：主题样式生成
- `createThemeBreakpoints`：响应式断点（3sm → 3xl）

### 2.8 工具库

**`@arwes/tools`**

- `isBrowser`：浏览器环境检测
- `cx`：classnames 合并
- `loadImage`：图片加载器
- `createTOScheduler`：超时/节流调度
- `randomizeList`：数组随机化

### 2.9 React 绑定

**`@arwes/react`** — 聚合包，导出全部 React 组件。核心组件一览：

| 类别 | 组件                                                |
| ---- | --------------------------------------------------- |
| 动画 | `Animated`、`AnimatedX`、`Animator`、`useAnimated`  |
| 背景 | `Dots`、`Puffs`、`GridLines`、`MovingLines`         |
| 音效 | `BleepsProvider`、`useBleeps`、`BleepsOnAnimator`   |
| 边框 | `FrameOctagon`、`FrameUnderline`、`FrameCorners` 等 |
| 文字 | `Text`                                              |
| 特效 | `Illuminator`、`IlluminatorSVG`                     |
| 工具 | `memo`、`mergeRefs`、`NoSSR`、`useUpdateEffect`     |

### 2.10 Solid 绑定

**`@arwes/solid-animator`**：SolidJS 版本的动画系统（`Animator`、`useAnimator`）
**`@arwes/solid`**：SolidJS 完整绑定

---

## 3. Flare CMS 内容管理系统

Flare CMS 是 fork 自 SonicJS 的 headless CMS，运行在 Cloudflare Workers 上。

### 3.1 CMS Worker

**`cms/packages/cms`** — Cloudflare Worker 应用

- `createFlareApp`：应用工厂（Hono 框架）
- D1 数据库绑定（`DB`）、KV 缓存（`CACHE_KV`）、媒体存储（`MEDIA_BUCKET` binding 或 S3 兼容适配器）
- `scheduled` 处理器：定时发布内容（cron 每分钟），与 HTTP 请求走同一套 provider 解析
- 存储后端由 `STORAGE_BACKEND` 选择（`r2` / `b2` / `s3`）；所选后端配置不完整时**启动即报错并列出缺失变量**，不会静默回退到 R2

### 3.2 Collections 集合系统

数据模型：`collections`（定义 schema）→ `content`（实际内容）

内置集合：

- **`blog-posts`**：博客文章（title、slug、excerpt、content、featuredImage、author、publishedAt、status、tags）
- **`docs`**：文档页面（title、slug、excerpt、content、section 引用、order、status）
- **`docs-sections`**：文档分区（导航引用）
- **`pages`**：静态页面（title、content、slug、meta_description、featured_image）

Schema 字段类型：`string`、`number`、`boolean`、`date`、`datetime`、`email`、`url`、`richtext`、`markdown`、`json`、`array`、`object`、`reference`、`media`、`select`、`multiselect`、`checkbox`、`radio`、`textarea`、`slug`、`color`、`file`、`quill`、`tinymce`、`mdxeditor` 等

### 3.3 Admin 管理后台

- **内容管理**：集合 CRUD、富文本编辑、字段校验
- **媒体库**：图片/文件上传（R2 / B2 / 任意 S3 兼容后端）
- **存储设置**：只读展示当前生效 provider（bucket / endpoint / region / 寻址方式）+ 连通性自检
- **用户管理**：角色（admin/editor/viewer）、邀请、会话
- **API Tokens**：只读访问令牌（`st_` 前缀，SHA-256 哈希存储）
- **工作流**：Draft → Review → Published 审批链
- **插件系统**：插件市场、缓存、示例插件、反馈表单等

### 3.4 存储后端

由 `STORAGE_BACKEND` 单一开关决定，三种 provider 共用同一套 `StorageBucket` 接口（`head` / `get` / `put` / `delete`）：

| `STORAGE_BACKEND` | Provider                                            | 配置                                                                                                                | 说明                                    |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 未设置 / `r2`     | Cloudflare R2                                       | `MEDIA_BUCKET` R2 binding                                                                                           | 默认，媒体读写不出 Cloudflare           |
| `b2`              | Backblaze B2                                        | `B2_BUCKET` / `B2_ACCESS_KEY_ID` / `B2_SECRET_ACCESS_KEY`（可选 `B2_ENDPOINT`、`B2_REGION`＝`us-west-004`）         | S3 兼容 API + SigV4 签名                |
| `s3`              | 通用 S3 兼容（AWS S3 / MinIO / Wasabi / R2 S3 API） | `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`（可选 `S3_ENDPOINT`、`S3_REGION`、`S3_FORCE_PATH_STYLE`） | 省略 endpoint 时按 region 推导 AWS 端点 |

别名：`cloudflare`/`cf` → r2，`backblaze` → b2，`aws`/`minio`/`wasabi`/`s3-compatible` → s3。

**`cms/packages/core/src/storage/`** — 存储抽象层：

- `resolveStorage(env)`：**唯一的 provider 决策点**，返回 `{ bucket, info }`；配置不完整时返回 `configured: false` + `missingVars`，绝不回退到 R2
- `S3Storage`：通用 S3 兼容适配器 —— `head` / `get` / `put` / `delete`（含批量删除）、AWS SigV4 签名（SHA-256 + HMAC）、string / ArrayBuffer / Blob / ReadableStream、`writeHttpMetadata` 元数据回写、按扩展名推断 Content-Type、path-style 与 virtual-hosted 寻址
- `STORAGE_PROVIDERS`：provider 目录（UI 展示与报错文案的唯一来源）
- `getStorageInfo(env)`：无凭据的运行时描述，供 API 与 Admin UI 使用
- `testStorageConnection(env)`：对当前 bucket 发起带签名的 `HEAD` 自检，404 视为连通，403/网络错误才判失败

**Admin UI（Settings → Storage）**：provider 由环境变量决定，因此 UI **只读**展示当前生效后端，并并列展示全部支持的 provider 及各自所需变量；提供"Test connection"按钮调用 `POST /admin/settings/storage/test`。媒体大小上限、备份频率、允许类型等仍可编辑。旧的 `storageProvider`（`cloudflare`/`s3`/`local`）下拉框已移除 —— 它保存到 D1 后从不被后端读取。

**`cms/packages/cms/src/storage/b2-storage.ts`** 现为兼容垫片，转发到 `@flare-cms/core` 的 `S3Storage`。

### 3.5 Astro 内容加载器

**`@flare-cms/astro`** — Astro Content Layer 集成

- `flareLoader`：构建时从 CMS API 拉取集合到 Astro content store
- 客户端过滤（`filter: { status: 'published' }`）
- 日期消毒、schema 校验、构建缓存
- `flareSchemaToZod`：CMS schema → Zod schema
- **注**：类型内联（`types-cms.ts`）使包自包含，不依赖 core 类型图

### 3.6 认证与 API Tokens

- 注册/登录（JWT，HTTP-only cookie + CSRF）
- 首个用户自动允许注册（bootstrap）
- API Token：只读 GET（`X-API-Key` 头），写入需用户 JWT

### 3.7 站点控制面（Sites）

CMS 是所有网站的**唯一控制面**：每个站点的构建、域名绑定与内容归属都在 CMS 中登记与操作，不再分散在 GitHub Actions 和 Cloudflare 控制台。

数据模型（迁移 `038_sites_registry.sql` + `039_site_hosting_providers.sql` + `040_site_build_environment.sql`）：`sites`（站点）→ `site_domains`（域名绑定），`content.site_id` 决定内容归属，`api_tokens.site_id` 把构建 token 钉在单个站点上。

- **站点注册表**（`sites`）：slug、托管类型、Worker 名/Pages 项目名、Git 仓库/分支、Deploy Hook、构建命令/deploy 命令/输出目录/根目录/Node 版本、**构建期环境变量**（`build_env` JSON + CMS 自动生成的 `PUBLIC_FLARE_*`）、内容前缀、启用状态、最近一次构建结果
- **托管类型与页面**：Admin → Sites **按类型分组**（Worker / Pages / External，各带计数与说明），支持 `?type=<provider>` 过滤；标签、可用字段与可执行动作全部来自 `services/site-providers.ts` 的元数据，因此 UI 不会给出该 provider 做不到的操作
- **构建**：Worker 站点通过 **Workers Builds API** 直接触发（`POST /accounts/{id}/builds/triggers/{uuid}/builds`，带分支，返回 build uuid），**不再强制依赖 Deploy Hook**；Pages 站点仍走 **Deploy Hook**。构建由 Cloudflare 执行、CMS 只负责触发与回显，所以 GitHub Actions 里不再有站点构建。结果（queued / failed + 错误原因）写回 `sites.last_build_*`，并记录触发方式（`api` / `hook`）
- **构建配置下发**：`syncBuildConfig()` 把构建命令/deploy 命令/根目录 `PATCH` 到 Workers Builds **trigger**（或 Pages 项目的 `build_config`），**并同时下发构建期环境变量**到 trigger（`PATCH .../triggers/{uuid}/environment_variables`）
- **构建期环境变量**：CMS 自动生成 `PUBLIC_FLARE_API_URL`（CMS 自身地址，站点可固定、否则取 `FLARE_API_URL` 或请求 origin）、`PUBLIC_FLARE_SITE`（站点 slug）、`PUBLIC_FLARE_API_TOKEN`（**只读、限定该站点**的 API token，可一键轮换）。站点可在 Site settings 里用同名变量覆盖任意一个；其他变量（如运维自己在控制台加的）不被触碰
- **域名绑定**：通过 **Cloudflare API** 真实创建/删除自定义域名，并把校验状态（pending / active / error + 失败原因）镜像到 `site_domains`；支持「从 Cloudflare 刷新」以采纳在控制台手工添加的域名、并把云端已消失的标记为 `removed`；可指定 primary 域名
- **预设**：`services/site-presets.ts` 用 `{{slug}}` 占位描述本仓库的构建契约，可一键导入缺失的站点：`apps/docs` 同时提供 **Worker 直传**与 **Pages 直传**两条预设（都走 `github-actions` 模式），新增一个 Astro 应用只需加一条预设，不必改代码
- **部署模式**（`sites.deploy_mode`，留空按 provider 取默认）：`workers-builds`（Cloudflare 从 Git 构建，CMS 下发构建环境变量）/ **`github-actions`**（CMS dispatch `.github/workflows/deploy-site.yml`，runner 构建后直传 Worker 或 `wrangler pages deploy` —— **Cloudflare 侧完全不需要 Git 连接，也不需要 Deploy Hook**）/ `deploy-hook`（Pages 默认）/ `direct-upload`（你自己构建，CMS 只登记）。能力矩阵按模式收窄，UI 不会给出该模式做不到的按钮
- **GitHub dispatch**：`services/github-actions.ts` 依次从 env（`GITHUB_TOKEN`/`GITHUB_REPO`）、已有的 `deploy.github_*` 设置、站点 `gitRepo` 解析目标；dispatch 时把**站点自己的** build/deploy 命令与 root directory 作为工作流输入，仓库始终是唯一真源。错误码被翻译成可执行建议（401 token 失效 / 403 缺 `Actions: write` / 404 仓库或工作流不存在 / 422 ref 或输入不匹配）。构建期内容读取不需要 CMS token（内容 API 对已发布内容公开，按 `X-Site` 隔离）
- **内容归属**：`content.site_id` 为 `NULL` 表示**共享内容**（所有站点可读），否则只属于该站点；后台可见每个站点拥有/共享的内容条数

**凭据**：Worker secrets `CF_API_TOKEN` / `CF_ACCOUNT_ID` 优先，缺省回落到 D1 设置，可在 Admin → Sites 中轮换而无需重新部署。**部署流水线会自动装好这两个 secret**：`.github/workflows/deploy.yml` 用 `wrangler secret put` 下发，优先取专用的 GitHub secret `CF_SITES_API_TOKEN`（最小权限 runtime token，`node scripts/set-cf-token.mjs runtime` 一键生成），未设置时回落到 CI 的 `CF_API_TOKEN` 并告警。Cloudflare API token、Deploy Hook URL（能力型 URL）与构建 token 都永不返回给客户端（JSON 响应中掩码）。

**代码**：`cms/packages/core/src/services/sites.ts`（注册表 + Cloudflare 客户端 + 构建/域名/构建环境逻辑）、`services/site-providers.ts`（托管类型元数据）、`services/site-presets.ts`（Arwes 预设）、`services/github-actions.ts`（Actions dispatch 与凭据解析）、`routes/admin-sites.ts`（页面 + JSON API，挂载于 `/admin/sites`）、`templates/pages/admin-sites.template.ts`（列表 / 新建 / 详情）、迁移 `041_site_deploy_mode.sql`。

**一次性前置条件**（每个站点）：托管目标需为 **Git 连接**（Pages 项目或 Worker 的 Workers Builds，使其存在 trigger；Direct Upload 无法重建）。Worker 站点随后由 CMS 下发构建设置与环境变量即可触发构建；Pages 站点还需创建 Deploy Hook 并填入站点。

#### 3.7.1 两种托管 provider

站点可选两种托管方式，域名与构建配置走**各自的 Cloudflare API**（`sites.provider`）：

| `provider`                        | 托管              | 域名 API                                                         | 构建配置所在               | 构建触发                                                                              |
| --------------------------------- | ----------------- | ---------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `cloudflare-worker`（推荐多站点） | Worker + 静态资源 | `PUT/DELETE /accounts/{id}/workers/domains`（**必须指定 zone**） | Workers Builds **trigger** | `POST /accounts/{id}/builds/triggers/{uuid}/builds`（CMS 直接触发），Deploy Hook 兜底 |
| `cloudflare-pages`                | Pages 项目        | `POST/DELETE /accounts/{id}/pages/projects/{p}/domains`          | Pages 项目 `build_config`  | `POST .../pages/webhooks/deploy_hooks/{id}`                                           |
| `external`                        | 仅登记            | —                                                                | —                          | —                                                                                     |

关键差异（都已按 provider 分支实现）：

- **多域名**：一个 Worker 可以挂**多个自定义域名**，所以「一个 Worker 服务多个站点」比「每站点一个 Pages 项目」省事得多；Pages 的域名是按项目挂的
- **Worker 域名必须属于某个 zone**：CMS 会自动把主机名匹配到该 token 可见的 zone（**最长后缀优先**，`example.co.uk` 胜过 `co.uk`），也可以在站点上固定 `cfZoneId`；匹配不到会给出明确报错。Pages 域名不需要 zone
- **绑定即生效**：Worker 域名由 Cloudflare 自动创建 DNS 记录并签发证书，因此绑定成功即为 `active`；Pages 域名需要运维自己指 DNS，所以先 `pending`
- **删除 Worker 域名不会删除自动签发的证书**（Cloudflare 明确说明），证书需另行清理
- **构建标识**：Workers Builds 用不可变的 **Worker tag**（不是名字）寻址，CMS 首次解析后缓存到 `sites.cf_worker_tag`；构建配置在 **trigger** 上，缓存在 `sites.cf_trigger_uuid`，并按站点的 Git 分支挑选 production trigger
- **构建去重**：Workers Builds 在已有排队/初始化中的构建时会返回同一个构建并带 `already_exists: true`，CMS 视为成功而非冲突
- **Deploy Hook 形状不同**：Pages 返回 `{ id, url }`，Workers 返回 `{ success, result: { build_uuid } }`；CMS 按 provider 解析，并**拒绝串用的 hook**（Worker 站点填 Pages hook 会直接报错，而不是静默不触发）
- **Worker 可以不配 Deploy Hook**：CMS 优先用 Builds API 触发（要显式给分支），只有在没有 trigger 或 API 失败时才回落到 Deploy Hook；两者都不可用时给出可执行的报错
- **构建环境变量**：`PUBLIC_FLARE_*` 由 CMS 计算并下发到 trigger。缺了它们，Astro 构建会静默回落到 `http://localhost:8787`，构建「成功」但内容为空——这正是把它们并入构建配置下发的原因
- **构建 token 钉站点**：自动签发的 token 带 `api_tokens.site_id`，服务端在解析内容作用域时**优先于** `X-Site`，因此一个站点的构建 token 改 `X-Site` 也读不到别的站点内容；轮换是显式动作（`rotateToken`）
- **Worker 不能自己构建**：Workers Builds 是 **Git 集成**（GitHub/GitLab），Worker 运行时没有构建工具链与可写文件系统，跑不了 `astro build`。不连 Git 的形态是 **Direct Upload**（本地构建 → `wrangler deploy` / assets-upload 三步 API 直接推版本），此时 CMS 负责域名与内容；要让 Cloudflare 自己构建且不连 Git 只能用 **Containers**（付费计划）。CMS 在没有 trigger 时会同时给出"连 Git"和"本地 direct upload"两条路，而不是只报错

**凭据**：Pages 站点需要 `Pages:Edit` + `Zone:Read`；Worker 站点额外需要 `Workers Scripts:Read`（解析 tag）与 `Workers Builds Configuration:Edit`，且 Builds API **只接受 user-scoped token**（account-scoped 会报 "Invalid token"，CMS 会在报错里补上这条提示）。

#### 3.7.2 按站点隔离内容

内容归属写在 `content.site_id`：`NULL` = **共享内容**（所有站点可读），否则只属于该站点。
读取时由服务端强制加一段作用域条件（`cms/packages/core/src/services/content-site-scope.ts`）：

| 请求方                                                           | 可见内容                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 标示了某个活跃站点（`X-Site: <slug\|id>` 或 `?site=<slug\|id>`） | 该站点内容 **+ 共享内容**（`site_id = ? OR site_id IS NULL`）                     |
| 使用**绑定了站点的 API token**（`api_tokens.site_id`）           | 固定为该站点 **+ 共享内容**，并**忽略** `X-Site`（构建 token 无法横向读别的站点） |
| 未标示站点，且部署中**已注册**站点                               | **仅共享内容**（`site_id IS NULL`）                                               |
| 未标示站点，且部署中**没有**任何站点                             | 全部内容（单租户，保持向后兼容）                                                  |
| 标示的站点不存在/已停用                                          | **404**（明确报错，而不是静默返回空列表）                                         |

设计要点：

- **作用域不可被调用方放宽**：条件通过 `QueryFilter.internalAnd` 注入（`parseFromQuery` 永不产生该字段），且站点 id 来自数据库查询而非请求原文
- **缓存不串站**：作用域作为 `filter` 的一部分参与缓存 key 计算，因此一个站点永远不会命中另一个站点的缓存
- **写归属**：后台内容表单新增 **Site 选择器**（未注册任何站点时整块隐藏，单租户部署表单不变）；`POST /api/content` 接受 `siteId`（id）或 `site`（slug）；不传则创建共享内容；站点不存在返回 400
- **不会误清空归属**：更新路径仅在表单**确实提交了** `site_id` 字段时才改写，因此任何没有渲染该字段的表单（如校验失败回显）都不会把已有归属静默清空；复制内容会继承原内容的站点
- **可见性回显**：响应 `meta.siteScope` 返回 `{ mode, siteSlug, identifiedBy, reason }`，便于排查「构建出来是空的」
- **构建端接入**：`@flare-cms/astro` 的 `flareLoader` / `flareLiveLoader` 新增 `site` 选项（发送 `X-Site`）；未识别到站点时会打印明确的告警而不是静默出空页面

**代码**：`services/content-site-scope.ts`（作用域解析 + `resolveSiteId`）、`utils/query-filter.ts`（`internalAnd` 支持）、`routes/api.ts` 与 `routes/api-content-crud.ts`（读隔离 + 写归属）、`routes/admin-content.ts` 与 `templates/pages/admin-content-form.template.ts`（后台归属编辑）。

---

## 4. 前端应用

### 4.1 文档站

**`apps/docs`** — Astro 7 + React islands + Tailwind，以 **Worker + 静态资源**方式托管（构建由 CMS 的 Sites 面板触发）

- 26 个静态路由（首页、文档、设计、开发指南、社区等）
- 自研客户端路由（`src/router/`）：拦截内部导航，history.pushState，无刷新切换
- CMS 页面：`/about` 等由 CMS `pages` 集合驱动，markdown → HTML 静态生成
- ARWES 动画：进入/退出切换、文字解密、背景粒子、边框
- 音效：按钮点击、页面进入、文字打字音
- 主题：深色科幻风，Titillium Web + Source Code Pro 字体
- 重新构建：在 Admin → Sites 打开该站点点 **Build now**（走 Workers Builds API，不需要 Deploy Hook），不再由 `deploy.yml` 构建

#### Worker 托管配置

- `src/worker.ts` — 兜底 Worker（宿主路由 + 候选路径解析）；`wrangler.jsonc` — `main` + `assets.directory = ./build` + `ASSETS` 绑定
- **计费优先的默认配置：不设 `run_worker_first`**。静态资源请求免费且无限，只有**调用 Worker 脚本**的请求计费；`run_worker_first` 会让匹配的每个请求都调用脚本（免费额度用尽后还会 429 而不是回落到资源）。配合 compatibility date ≥ 2025-04-01 的 `assets_navigation_prefers_asset_serving`，命中已有文件的**导航请求也不调用 Worker**，因此正常页面与子资源流量全部免费，Worker 只在"没有匹配到任何文件"时兜底
- `assets.html_handling = "drop-trailing-slash"`：Astro 用 `build.format: 'directory'`（页面在 `about/index.html`），该策略让 `/about` **直接**提供该文件（只有 `/about/` 才重定向），URL 稳定且**不需要 Worker 参与**。默认的 `auto-trailing-slash` 会把 `/about` 307 到 `/about/`；`"none"` 则要求 Worker 解析每个页面（每请求计费）
- `assets.not_found_handling = "404-page"`：未命中时由资源层返回最近的 `404.html`（404 状态），同样不调用 Worker
- 只处理 `GET`/`HEAD`，其他方法 405；`SITE_ROUTES`/`DEFAULT_SITE_PREFIX` 仍保留在 `src/worker.ts`——**但"一个 Worker 服务多个站点"必须开启 `run_worker_first`，从而每个请求都计费**，因此单站点默认走免费路径；要一 Worker 多站点就显式开回 `run_worker_first` 并接受计费，或者干脆每站点一个 Worker（CMS 的 `sites.cfProjectName` 正是这个模型）
- `scripts/build-worker.sh` — 构建链：先建 cms 工作区（core + `@flare-cms/astro`），再建 ARWES packages，最后 `astro build`。**Cloudflare 无法在 Worker 里跑这条链**（Workers Builds 是 Git 集成，Worker 无构建工具链），不连 Git 时用 `npm run worker:deploy`（Direct Upload）本地/CI 构建后直传

组件库（`src/ui/`）：`Header`（导航栏+设置+音效开关）、`Nav`（侧边栏菜单）、`Button`、`Card`、`CodeBlock`（prism 高亮）、`Table`、`Modal`、`Breadcrumbs`、`FrameAlert` 等

### 4.2 沙盒

**`apps/play`** — webpack 沙盒演示

- 交互式示例、ARWES 组件实时演示
- 端口 9000

### 4.3 性能测试

**`apps/perf`** — 性能测试面板

- 基准测试 ARWES 组件性能
- 端口 9001

---

## 5. 运维与部署

### 5.1 GitHub Actions 自动部署

**`.github/workflows/deploy.yml`** — 只部署 CMS Worker（推送 `main`/`next` 或 `workflow_dispatch`）：

1. pnpm 安装（`--ignore-scripts`）、构建 core + astro
2. secrets 注入 wrangler.toml（D1/KV 资源 ID；`STORAGE_BACKEND=b2|s3` 时移除 R2 binding 并注入对应 provider 变量）
3. D1 迁移 → `wrangler deploy --env production`
4. JWT_SECRET 设为 Worker secret

> **为什么只有 CMS**：站点的构建、域名与内容统一由 CMS 自身管理（见 3.7 站点控制面），
> 因此原先的 `deploy-docs` job（构建 `apps/docs` + `wrangler pages deploy`）已移除。
> 站点重建由 CMS 通过 Cloudflare Pages Deploy Hook 触发，站点构建不再出现在 GitHub Actions 中。

另：**`.github/workflows/ci.yml`** — 常规 CI（构建、格式、lint、测试）。

### 5.2 初始化 TUI 向导

**`scripts/setup-tui-opentui.mjs`** — OpenTUI 全屏交互向导：

1. GitHub 登录（WebAuth 设备流，浏览器授权）
2. GitHub Actions 状态查看（workflows / 最近 runs）
3. Cloudflare 登录（OAuth 或 API Token）
4. 创建 D1 / R2 / KV（自动登记 secrets）
5. Backblaze B2 配置（可选）
6. JWT_SECRET 生成与留存
7. 本地 `.dev.vars`（可选）与前端 `.env`

特性：Esc 返回上层、Ctrl+C 退出、libsodium 加密写 secrets、所有凭据本地零留存。

### 5.3 OAuth 登录脚本

**`scripts/oauth-login.mjs`** — 命令行 OAuth 双登录：

- GitHub 设备流（code 展示 + 轮询）
- Cloudflare PKCE 授权码流（本地回调 8976 端口，state 校验）
- 结果持久化到 `node_modules/.oauth-state.json`（gitignored）

### 5.4 GitHub Secrets 管理

**`scripts/configure-secrets.mjs`** — 从 OAuth 状态创建/更新部署 secrets：

- `CF_API_TOKEN` / `CF_ACCOUNT_ID` / `CF_D1_DATABASE_ID` / `CF_R2_BUCKET_NAME` / `CF_KV_NAMESPACE_ID` / `JWT_SECRET` / `FLARE_API_URL` / `PAGES_PROJECT_NAME`

**`scripts/set-b2-secrets.mjs`** — B2 凭据写入工具。

### 5.5 B2 部署配置脚本

**`scripts/storage-config.py`** — 部署时按 `STORAGE_BACKEND` 改写 wrangler.toml（多 provider）：

- `STORAGE_BACKEND` 为 `b2` / `s3` 时：移除所有 `[[*r2_buckets]]` 块（顶层 + env.production + env.staging）
- 顶层 `[vars]` 与 `[env.production]` vars 分别注入 `STORAGE_BACKEND` + 对应 provider 变量（env 不继承顶层）
- 必填变量缺失时以 `::error::` 退出（exit 1），不会生成半成品配置
- `STORAGE_BACKEND` 未设置或为 `r2` 时不做任何修改
- 值从环境变量读取（secrets 传递），只改运行器内的临时 wrangler.toml

**`scripts/b2-config.py`** — 向后兼容垫片：`STORAGE_BACKEND` 未设置时按 `b2` 委托给 `storage-config.py`。

### 5.6 本地开发脚本

**`scripts/cms.sh`**：`dev` / `build` / `deploy` / `migrate` / `migrate:local` / `seed`
**`scripts/www.sh`**：打包全部站点到 `www/`
**`scripts/clean.sh`**：清理构建产物
**`scripts/pkg-build-*.sh`**：包构建（ESM/CJS）

---

## 6. 架构图

```text
┌─────────────────────────────────────────────────────────────┐
│                          GitHub                              │
│  repo: cqusfa456/sci-fi-cms                                  │
│  push main → Actions (deploy.yml: 只部署 CMS Worker)          │
│  Secrets: CF_API_TOKEN / CF_ACCOUNT_ID / D1/KV IDs /        │
│           JWT_SECRET / FLARE_API_URL / B2_* / S3_*          │
└───────────────────────────┬─────────────────────────────────┘
                            │ 仅 CMS Worker
                   ┌────────▼─────────┐
                   │  CMS Worker     │
                   │  flare-cms      │
                   │  D1 (内容/站点) │
                   │  KV (缓存)      │
                   │  R2/B2/S3 (媒体)│
                   └────────┬─────────┘
                            │
       ┌────────────────────┼──────────────────────────┐
       │ 站点控制面          │                          │
       │ (Admin → Sites)    │ Deploy Hook              │
       │ · 构建触发 ─────────┼──────────────┐           │
       │ · 域名绑定 ─ CF API ┼───────────┐  │           │
       │ · 构建配置下发 ─────┼─────────┐ │  │           │
       └────────────────────┘         │ │  │           │
                                      ▼ ▼  ▼           │
                     ┌──────────────────────────────┐  │
                     │ Cloudflare Worker            │  │
                     │ (arwes-docs-worker)          │◄─┘
                     │ 静态资源 + host→站点 路由    │  内容 API
                     │ 可挂多个自定义域名           │
                     │ Cloudflare 执行构建          │
                     └──────────────────────────────┘
                       │  build-time
                       ▼
                ┌──────────────────┐
                │  @flare-cms/astro│
                │  flareLoader     │
                └──────────────────┘

本地开发:
  sh ./scripts/cms.sh dev      → CMS @ :8787 (/admin)
  cd apps/docs && npm run dev  → Docs @ :9002
  cd apps/docs && npm run worker:dev → Worker @ :8787（wrangler dev）
  npm run setup                → OpenTUI 初始化向导
```

---

## 7. 技术栈汇总

| 层    | 技术                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------- |
| 框架  | Astro 7、React 18、SolidJS                                                                        |
| 前端  | Tailwind CSS 3、prism-react-renderer、iconoir 图标                                                |
| 状态  | jotai（客户端路由 pathname）                                                                      |
| 后端  | Cloudflare Workers（Hono）、D1（SQLite）、KV                                                      |
| 存储  | Cloudflare R2 binding / Backblaze B2 / 通用 S3 兼容（统一 `StorageBucket` + SigV4）               |
| 构建  | turbo（monorepo）、pnpm（cms 工作区）、tsup（包构建）、vite（Astro）、webpack（play/perf）        |
| CI/CD | GitHub Actions（deploy：仅 CMS Worker；ci）                                                       |
| 站点  | CMS 站点控制面：Pages Deploy Hook 触发构建 + Cloudflare API 管理域名 + `content.site_id` 内容归属 |
| 工具  | OpenTUI（TUI 向导）、libsodium（secrets 加密）、undici（代理）                                    |
| 语言  | TypeScript（strict）、Python（存储配置脚本）、Shell                                               |
