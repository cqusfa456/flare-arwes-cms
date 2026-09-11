#!/bin/sh
# Flare CMS 本地开发启动脚本
# 用法: sh ./scripts/cms.sh [dev|build|deploy|migrate|seed]

set -e

cd "$(dirname "$0")/../cms"

case "$1" in
  dev)
    echo "▶ 启动 Flare CMS 本地服务 (http://localhost:8787)"
    echo "  Admin UI: http://localhost:8787/admin"
    cd packages/cms
    npx wrangler dev --local --port 8787
    ;;
  build)
    echo "▶ 构建 Flare CMS 包"
    pnpm build
    pnpm build:astro
    ;;
  deploy)
    echo "▶ 部署 Flare CMS 到 Cloudflare Workers"
    cd packages/cms
    npx wrangler deploy --env production
    ;;
  migrate)
    echo "▶ 运行数据库迁移 (远程)"
    cd packages/cms
    npx wrangler d1 migrations apply DB --env production
    ;;
  migrate:local)
    echo "▶ 运行数据库迁移 (本地)"
    cd packages/cms
    npx wrangler d1 migrations apply DB --local
    ;;
  seed)
    echo "▶ 创建初始管理员用户"
    cd packages/cms
    npx tsx scripts/seed-admin.ts
    ;;
  *)
    echo "用法: sh ./scripts/cms.sh [dev|build|deploy|migrate|migrate:local|seed]"
    ;;
esac
