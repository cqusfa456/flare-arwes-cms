-- Migration 041: Per-site deploy mode
--
-- Why this exists
-- ---------------
-- Cloudflare cannot build a site inside a Worker: Workers Builds is a Git
-- integration (GitHub/GitLab), and a Worker has no build toolchain or writable
-- filesystem. So a deployment that refuses a Cloudflare-side Git connection needs
-- somewhere else to run `astro build` — the CMS dispatches a GitHub Actions
-- workflow instead, and that workflow uploads the output directly (Workers
-- assets API) or to a Pages project (Direct Upload). Neither path needs a Git
-- connection inside Cloudflare.
--
-- `deploy_mode` records which of those a site uses, because the CMS behaves
-- differently for each:
--
--   'workers-builds'  Cloudflare builds it from Git; the CMS fills build
--                     settings + build environment on the trigger and starts
--                     builds through the Builds API. (default for Workers)
--   'github-actions'  The CMS dispatches .github/workflows/deploy-site.yml with
--                     the site's build contract; the runner builds and uploads.
--                     No Git connection in Cloudflare, no Deploy Hook.
--   'deploy-hook'     A stored Deploy Hook URL rebuilds the site. (default for
--                     Pages projects, which build on Cloudflare's side)
--   'direct-upload'   Nothing to trigger: the operator builds locally and runs
--                     `wrangler deploy` / `wrangler pages deploy` themselves.
--
-- NULL keeps the provider default, so existing rows are unaffected and an
-- operator only sets a value when they want the non-default path.

ALTER TABLE sites ADD COLUMN deploy_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_sites_deploy_mode ON sites(deploy_mode);
