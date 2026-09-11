-- Migration 040: Build environment for sites + per-site content tokens
--
-- Why this exists
-- ---------------
-- Migration 038/039 made the CMS the control plane for a site's build settings
-- and domains, but a site's *build* still had to be told where the CMS lives and
-- which site it is building for. Those three values are build-time environment
-- variables on the Workers Builds trigger:
--
--   PUBLIC_FLARE_API_URL    where the CMS API is (the Astro loader default is
--                           http://localhost:8787, which never works in CI)
--   PUBLIC_FLARE_SITE       the site slug, sent as `X-Site` so the CMS serves
--                           that site's content (see 038 for content.site_id)
--   PUBLIC_FLARE_API_TOKEN  a read-only API token so the build can read content
--                           from a deployment that has sites registered
--
-- `build_env` holds operator-defined extras (or overrides) as JSON:
--   {"NODE_ENV": {"value": "production", "secret": false}}
--
-- Token storage: the API token service stores only a SHA-256 hash, so a token's
-- plaintext cannot be recovered after creation. The CMS must be able to re-push
-- the same value on every build-config sync, so the plaintext of *this* token is
-- kept in `content_token`. It is a read-only token scoped to one site, it is
-- never serialized to clients (the routes layer masks it like deploy_hook_url),
-- and rotating it is an explicit action.

ALTER TABLE sites ADD COLUMN build_env TEXT;
ALTER TABLE sites ADD COLUMN content_token TEXT;
ALTER TABLE sites ADD COLUMN content_token_id TEXT;

-- `api_tokens` has been missing the columns its own service inserts since the
-- initial schema (001): createApiToken() writes token_hash / token_prefix /
-- allowed_collections / is_read_only, and validateApiToken() looks tokens up by
-- token_hash. Without these columns every API-token creation fails with
-- "no such column", which also made it impossible to scope a token to a site.
ALTER TABLE api_tokens ADD COLUMN token_hash TEXT;
ALTER TABLE api_tokens ADD COLUMN token_prefix TEXT;
ALTER TABLE api_tokens ADD COLUMN allowed_collections TEXT;
ALTER TABLE api_tokens ADD COLUMN is_read_only INTEGER NOT NULL DEFAULT 1;

-- A token may be bound to one site. When set, the API ignores any client-supplied
-- X-Site/`site` value and serves that site's content only, so a build token
-- issued for one site can never read another site's content.
ALTER TABLE api_tokens ADD COLUMN site_id TEXT;

CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_site ON api_tokens(site_id);
