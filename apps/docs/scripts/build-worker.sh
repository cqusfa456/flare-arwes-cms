#!/bin/sh
# Full monorepo build for the docs site.
#
# This is the site's recorded `build_command` (Admin → Sites in the CMS). The CMS
# dispatches .github/workflows/deploy-site.yml with it, so the build runs in
# GitHub Actions and the workflow uploads the output directly:
#
#   build_command  : sh ./apps/docs/scripts/build-worker.sh
#   deploy_command : wrangler pages deploy apps/docs/build --project-name=...  (cloudflare-pages)
#                    wrangler deploy                                           (cloudflare-worker)
#
# The order matters, because apps/docs consumes build output from two other
# workspaces:
#
#   1. cms workspace            → @sci-fi-cms/core and @sci-fi-cms/astro (file: dep)
#   2. ARWES packages workspace → @arwes/* consumed via workspace links
#   3. apps/docs                → Astro build into apps/docs/build
#
# Step 3 is where content enters. The Astro content loader fetches published
# content from the CMS API (PUBLIC_SCIFI_API_URL / PUBLIC_SCIFI_SITE, provided by
# the workflow) and bakes it into static HTML; the CMS Worker answers that API
# from D1. The browser therefore never queries the CMS or D1, and no page content
# is assembled at runtime.

set -e

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "==> [1/3] Building the CMS workspace (core + astro integration)"
cd "$ROOT/cms"
pnpm install --frozen-lockfile --ignore-scripts
# The runtime migration bundle is generated from cms/packages/core/migrations. pnpm
# does not run pre/post scripts, so core's `prebuild` hook does not fire: invoke the
# generator explicitly, or a new migration never reaches the Worker that applies it.
pnpm --filter @sci-fi-cms/core generate:migrations
pnpm build
pnpm --filter @sci-fi-cms/astro build

echo "==> [2/3] Building ARWES packages"
cd "$ROOT"
# HUSKY=0 so the root install does not try to install git hooks in CI.
HUSKY=0 npm install --engine-strict=false
# Only the packages: building apps/docs here would run the Astro build before
# PUBLIC_SCIFI_* variables are applied, which is what step 3 is for.
npx turbo build --filter='./packages/*'

echo "==> [3/3] Building the docs site"
cd "$ROOT/apps/docs"
npm run build

echo "==> Done. Static output is in apps/docs/build"
