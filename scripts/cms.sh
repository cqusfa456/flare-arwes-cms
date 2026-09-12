#!/bin/sh
# Sci-Fi CMS 本地开发启动脚本
# 用法: sh ./scripts/cms.sh [dev|build|deploy|migrate|seed]

set -e

cd "$(dirname "$0")/../cms"

case "$1" in
  dev)
    echo "▶ 启动 Sci-Fi CMS 本地服务 (http://localhost:8787)"
    echo "  Admin UI: http://localhost:8787/admin"
    cd packages/cms
    npx wrangler dev --local --port 8787
    ;;
  build)
    echo "▶ 构建 Sci-Fi CMS 包"
    pnpm build
    pnpm build:astro
    ;;
  deploy)
    echo "▶ 部署 Sci-Fi CMS 到 Cloudflare Workers"
    cd packages/cms
    npx wrangler deploy --env production
    ;;
  migrate)
    # 注意：这条命令操作的是 **本地** 数据库（wrangler 需要显式 --remote 才会连远端），
    # 所以它只是本地演练。生产库的 schema 由 CMS 自己在运行时迁移：
    # Worker 打包了全部 migrations/*.sql，bootstrapMiddleware 会在第一个请求时
    # 调用 MigrationService(c.env.DB).runPendingMigrations() 并记录到自己的
    # migrations 表（对 "already exists" / "duplicate column name" 幂等）。
    echo "▶ 在本地数据库上演练迁移（生产库由 CMS 运行时自动迁移）"
    cd packages/cms
    npx wrangler d1 migrations apply DB --local
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
