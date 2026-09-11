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
- D1 数据库绑定（`DB`）、KV 缓存（`CACHE_KV`）、R2 或 B2 存储（`MEDIA_BUCKET`）
- `scheduled` 处理器：定时发布内容（cron 每分钟）
- 存储后端自动切换：`STORAGE_BACKEND=b2` 时用 B2，否则用 R2

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
- **媒体库**：图片/文件上传（R2 或 B2）
- **用户管理**：角色（admin/editor/viewer）、邀请、会话
- **API Tokens**：只读访问令牌（`st_` 前缀，SHA-256 哈希存储）
- **工作流**：Draft → Review → Published 审批链
- **插件系统**：插件市场、缓存、示例插件、反馈表单等

### 3.4 存储后端

| 后端          | 绑定/配置                          | 说明                     |
| ------------- | ---------------------------------- | ------------------------ |
| Cloudflare R2 | `MEDIA_BUCKET` R2 binding          | 默认，需账号启用 R2      |
| Backblaze B2  | `STORAGE_BACKEND=b2` + `B2_*` vars | S3 兼容 API + SigV4 签名 |

**`cms/packages/cms/src/storage/b2-storage.ts`** — B2 适配器（R2 兼容接口）：

- `put` / `get` / `head` / `delete`（含批量删除）
- AWS Signature V4 签名（SHA-256 + HMAC）
- 支持 string / ArrayBuffer / Blob / ReadableStream
- `writeHttpMetadata`：HTTP 元数据回写
- Content-Type 推断（按扩展名）

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

---

## 4. 前端应用

### 4.1 文档站

**`apps/docs`** — Astro 7 + React islands + Tailwind

- 26 个静态路由（首页、文档、设计、开发指南、社区等）
- 自研客户端路由（`src/router/`）：拦截内部导航，history.pushState，无刷新切换
- CMS 页面：`/about` 等由 CMS `pages` 集合驱动，markdown → HTML 静态生成
- ARWES 动画：进入/退出切换、文字解密、背景粒子、边框
- 音效：按钮点击、页面进入、文字打字音
- 主题：深色科幻风，Titillium Web + Source Code Pro 字体

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

**`.github/workflows/deploy.yml`** — 推送 `main` 触发：

1. **Deploy CMS Worker**：
   - pnpm 安装（`--ignore-scripts`）、构建 core + astro
   - secrets 注入 wrangler.toml（D1/KV 资源 ID；B2 模式移除 R2 binding 并注入 B2 vars）
   - D1 迁移 → `wrangler deploy --env production`
   - JWT_SECRET 设为 Worker secret
2. **Deploy Docs Site**：
   - 构建 ARWES packages + `@flare-cms/astro`
   - Node 22 + Astro 7 构建 docs（`PUBLIC_FLARE_API_URL` 指向 CMS）
   - `wrangler pages deploy` → Cloudflare Pages（生产分支 main）

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

**`scripts/b2-config.py`** — 部署时改写 wrangler.toml：

- 移除所有 `[[*r2_buckets]]` 块（顶层 + env.production + env.staging）
- 顶层 `[vars]` 注入 B2 变量
- `[env.production]` vars 注入 B2 变量（env 不继承顶层）
- 值从环境变量读取（secrets 传递）

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
│  repo: cqusfa456/flare-arwes-cms                             │
│  push main → Actions (deploy.yml)                            │
│  Secrets: CF_API_TOKEN / CF_ACCOUNT_ID / D1/KV IDs /        │
│           JWT_SECRET / FLARE_API_URL / B2_*                 │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
   ┌────────▼─────────┐          ┌────────▼─────────┐
   │  CMS Worker     │          │  Docs Pages     │
   │  flare-cms      │          │  arwes-docs     │
   │  Workers        │          │  Astro 7 build  │
   │                 │          │  React islands  │
   │  D1 (内容)      │          │  Tailwind       │
   │  KV (缓存)      │          │  ARWES 动画      │
   │  R2 / B2 (媒体) │          └──────────────────┘
   └────────┬─────────┘
            │  /api/collections/*/content
            ▼
   ┌──────────────────┐   build-time    ┌──────────────────┐
   │  Admin UI        │←────────────────│  @flare-cms/astro│
   │  (browser)       │    flareLoader   │  content loader  │
   └──────────────────┘                  └──────────────────┘

本地开发:
  sh ./scripts/cms.sh dev      → CMS @ :8787 (/admin)
  cd apps/docs && npm run dev  → Docs @ :9002
  npm run setup                → OpenTUI 初始化向导
```

---

## 7. 技术栈汇总

| 层    | 技术                                                                                       |
| ----- | ------------------------------------------------------------------------------------------ |
| 框架  | Astro 7、React 18、SolidJS                                                                 |
| 前端  | Tailwind CSS 3、prism-react-renderer、iconoir 图标                                         |
| 状态  | jotai（客户端路由 pathname）                                                               |
| 后端  | Cloudflare Workers（Hono）、D1（SQLite）、KV                                               |
| 存储  | Cloudflare R2 / Backblaze B2（S3 兼容 + SigV4）                                            |
| 构建  | turbo（monorepo）、pnpm（cms 工作区）、tsup（包构建）、vite（Astro）、webpack（play/perf） |
| CI/CD | GitHub Actions（deploy + ci workflow）                                                     |
| 工具  | OpenTUI（TUI 向导）、libsodium（secrets 加密）、undici（代理）                             |
| 语言  | TypeScript（strict）、Python（b2 配置脚本）、Shell                                         |
