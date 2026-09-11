-- Migration 038: Sites registry (CMS as the control plane for all websites)
--
-- Until now every site was configured outside the CMS: its build lived in
-- .github/workflows/deploy.yml and its domain bindings lived in the Cloudflare
-- dashboard. This migration makes the CMS the single source of truth so one
-- place owns each site's build, domains and content ownership.
--
-- Design notes:
--  * `deploy_hook_url` is the Cloudflare Pages Deploy Hook the CMS POSTs to in
--    order to rebuild the site. Pages performs the build, so the CMS never runs
--    a site's build itself.
--  * `build_command` / `output_dir` / `root_dir` / `node_version` are mirrored
--    to the Pages project through the Cloudflare API (`syncBuildConfig`), so the
--    CMS can (re)provision a site's build settings.
--  * Domains live in their own table rather than a JSON column so each binding
--    can carry its own validation state and be audited individually.
--  * `content.site_id` is nullable: NULL means "shared content, readable by
--    every site", which keeps existing rows valid after the migration.

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Hosting target
  provider TEXT NOT NULL DEFAULT 'cloudflare-pages',
  cf_project_name TEXT,
  git_repo TEXT,
  git_branch TEXT DEFAULT 'main',

  -- Build configuration (mirrored to Cloudflare Pages)
  deploy_hook_url TEXT,
  build_command TEXT,
  output_dir TEXT,
  root_dir TEXT,
  node_version TEXT,
  build_config_synced_at INTEGER,

  -- Content ownership: content rows are scoped by site_id; this optional prefix
  -- namespaces slugs when several sites share one collection.
  content_prefix TEXT,

  is_active INTEGER NOT NULL DEFAULT 1,

  -- Last observed build
  last_build_at INTEGER,
  last_build_status TEXT,
  last_build_id TEXT,
  last_build_url TEXT,
  last_build_error TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active);
CREATE INDEX IF NOT EXISTS idx_sites_cf_project ON sites(cf_project_name);

-- Custom domain bindings per site.
CREATE TABLE IF NOT EXISTS site_domains (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,

  -- 'pending' (awaiting DNS/cert), 'active', 'error', 'removed'
  status TEXT NOT NULL DEFAULT 'pending',
  cf_domain_id TEXT,
  validation_status TEXT,
  validation_errors TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(site_id, hostname)
);

CREATE INDEX IF NOT EXISTS idx_site_domains_site ON site_domains(site_id);
CREATE INDEX IF NOT EXISTS idx_site_domains_hostname ON site_domains(hostname);

-- Content ownership. NULL = shared/global content, readable by every site.
ALTER TABLE content ADD COLUMN site_id TEXT;

CREATE INDEX IF NOT EXISTS idx_content_site ON content(site_id);
