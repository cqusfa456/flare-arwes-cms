---
title: 用 Sci-Fi CMS 驱动 ARWES 站点
slug: cms-driven-arwes-site
meta_description: 这个文档站现在由 Sci-Fi CMS 管理内容：页面、文档与侧边栏导航都来自 CMS，而不是写死在代码里。
---

# 用 Sci-Fi CMS 驱动 ARWES 站点

这个站点（`apps/docs`）是在构建时从 Sci-Fi CMS 读取内容的：Astro 的 Content Layer
loader 会在 `astro build` 期间请求 CMS 的公开内容接口，把结果写进内容存储，之后
`getCollection()` 就能像读取本地 Markdown 一样读取它们。

## 内容从哪里来

| 内容 | CMS 集合 | 站点路径 |
| --- | --- | --- |
| 博客 / 普通页面 | `pages` | `/blog/<slug>` |
| 文档正文 | `docs` | `/docs/<slug>` |
| 文档分组 | `docs-sections` | 侧边栏标题 |

## 构建时的约定

CI 构建（由 CMS 派发的 `deploy-site.yml`）**直接读 D1**：它用当次运行铸造的 Cloudflare
凭据调 D1 查询接口，按站点作用域取出内容。这样数据库就是唯一事实来源，构建既不依赖
Worker 是否可达，也不会读到缓存的旧响应。取数失败会让构建**失败**，而不是发布一个
内容为空的站点。

本地开发没有 Cloudflare 凭据，于是回退到 CMS 的公开接口，并打印一条说明：

- `PUBLIC_SCIFI_API_URL`：CMS Worker 的地址（回退路径）
- `PUBLIC_SCIFI_SITE`：站点 slug（注册于 Admin → Sites）

第二个变量很关键：**一旦 CMS 里注册了任何站点，未标识站点的构建只能看到共享内容**。
如果站点突然渲染成空页面，先检查它。

> 缺少 D1 凭据时 loader 会回退到 `PUBLIC_SCIFI_API_URL`；两者都没有则回退到
> `http://localhost:8787`，抓取失败后内容集合为空——页面会"成功"构建，但内容不见了。
> CI 里对 D1 凭据有显式的前置检查。
