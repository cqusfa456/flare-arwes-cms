---
title: 一次性凭据与站点部署链路
slug: deploy-credential-chain
meta_description: 从账户级 bootstrap token 到短期部署 token，再到 Worker 运行时凭据——这条链路里的每一环都是按需铸造、用完即弃。
---

# 一次性凭据与站点部署链路

站点部署由 CMS 驱动：在 Admin → Sites 点一下，CMS 就向 GitHub 派发
`deploy-site.yml`，由它构建静态产物并直接上传（Worker 用 `wrangler deploy`，
Pages 用 `wrangler pages deploy` 的 Direct Upload）。Cloudflare 侧完全不需要连接 Git。

## 凭据链

仓库里长期保存的只有一把**账户级 bootstrap token**（`CF_BOOTSTRAP_TOKEN`，权限
`account_api_tokens:edit`）。它在每次运行时按需铸造更短的凭据：

1. CI 用 bootstrap token 铸造一把有效期 1 天的部署 token（`scripts/ci-cf-credential.sh`）；
2. 部署步骤再根据它维护 Worker 的运行时凭据（`scripts/ci-runtime-credential.sh`），
   快过期才轮换，并删除被取代的旧 token。

这样泄漏面很小：仓库里没有长期有效的部署 token，运行时里也没有。

## 几个容易踩的点

- 账户级 token 的 `expires_on` 必须是**秒级精度**的 `...Z`，带毫秒会被拒绝。
- 指定 zone 作用域时必须**嵌套在账户资源下**，否则报 "Must specify a zone for
  account owned tokens"。
- Web OAuth **无法**创建账户级 token（`invalid_scope`），所以自动化只能走 bootstrap token。

## 判断部署是否真的成功

不要只看工作流是绿的：直接请求站点，确认内容非空、`/api/system/health` 健康，
并且构建日志里确实出现了 CMS 文档页面。产物为空但构建成功，是这条链路上最容易漏掉
的失败模式。
