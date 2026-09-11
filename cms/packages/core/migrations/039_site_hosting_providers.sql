-- Migration 039: Provider-aware site hosting
--
-- Route B of the hosting decision: a site may be hosted as a Cloudflare Pages
-- project OR as a Worker with static assets. Domain bindings and build
-- configuration are managed through different Cloudflare APIs depending on
-- which, so the registry needs to record a few provider-specific identifiers.
--
-- Why each column exists (verified against the Cloudflare docs, 2026):
--
--  * `cf_worker_tag` — the Workers **Builds API identifies Workers by their
--    immutable tag** (`external_script_id`), not by name. Listing builds
--    requires the tag, so we cache it here after resolving it once from
--    GET /accounts/{id}/workers/scripts, and refresh it if a call 404s.
--
--  * `cf_trigger_uuid` — Workers Builds configuration (build command, deploy
--    command, root directory, branch filters) lives on a **trigger**, not on
--    the Worker. Updating "how the site is built" means
--    PATCH /accounts/{id}/builds/triggers/{uuid}, so we cache the production
--    trigger uuid.
--
--  * `cf_zone_id` — a **Worker custom domain must name the Cloudflare zone** it
--    belongs to (unlike a Pages custom domain, which only needs the hostname).
--    A site may pin one; otherwise the zone is resolved from the hostname at
--    bind time and recorded on the domain row.

-- Provider-specific identifiers on the site.
ALTER TABLE sites ADD COLUMN cf_worker_tag TEXT;
ALTER TABLE sites ADD COLUMN cf_trigger_uuid TEXT;
ALTER TABLE sites ADD COLUMN cf_zone_id TEXT;

-- Workers Builds splits building and deploying into two commands per trigger,
-- so the deploy command needs its own column (Pages has no equivalent).
ALTER TABLE sites ADD COLUMN deploy_command TEXT;

-- Zone actually used for a Worker custom domain (kept per domain because one
-- site can legitimately span zones, e.g. example.com + example.co.uk).
ALTER TABLE site_domains ADD COLUMN cf_zone_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sites_provider ON sites(provider);
