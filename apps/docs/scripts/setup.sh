#!/bin/sh
# Pre-build step, run by `npm run build` before `astro build`.

set -e

DATE=$(date -Iseconds)
echo "export const DEPLOY_TIME = '$DATE';" >| ./src/dynamics.ts

rm -rf ./public
cp -r ../../static/ ./public/

# Pages authored in the CMS are written to real .astro files so Astro compiles
# them like any other page. A failure here fails the build: publishing a site with
# missing or stale pages would be worse than not publishing at all.
node ./scripts/sync-cms-pages.mjs
