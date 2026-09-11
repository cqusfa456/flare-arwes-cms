#!/bin/sh
# Full monorepo build for the docs Worker.
#
# This is the `build_command` for the Cloudflare Workers Builds trigger
# (root_directory = "/"):
#
#   build_command  : sh ./apps/docs/scripts/build-worker.sh
#   deploy_command : cd apps/docs && ../../cms/packages/cms/node_modules/.bin/wrangler deploy
#
# The order matters and mirrors what the removed `deploy-docs` job in
# .github/workflows/deploy.yml used to do, because apps/docs consumes build
# output from two other workspaces:
#
#   1. cms workspace            → @flare-cms/core and @flare-cms/astro (file: dep)
#   2. ARWES packages workspace → @arwes/* consumed via workspace links
#   3. apps/docs                → Astro build into apps/docs/build
#
# Building the site on Cloudflare means no site build lives in GitHub Actions
# anymore; only the CMS Worker is deployed from there.

set -e

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "==> [1/3] Building the CMS workspace (core + astro integration)"
cd "$ROOT/cms"
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm --filter @flare-cms/astro build

echo "==> [2/3] Building ARWES packages"
cd "$ROOT"
# HUSKY=0 so the root install does not try to install git hooks in CI.
HUSKY=0 npm install --engine-strict=false
# Only the packages: building apps/docs here would run the Astro build before
# PUBLIC_FLARE_* variables are applied, which is what step 3 is for.
npx turbo build --filter='./packages/*'

echo "==> [3/3] Building the docs site"
cd "$ROOT/apps/docs"
npm run build

echo "==> Done. Static output is in apps/docs/build"
