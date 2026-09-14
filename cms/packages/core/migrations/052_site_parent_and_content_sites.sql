-- Migration 052: a site can be mounted on a parent site, and content can belong
-- to several sites
--
-- Two changes, both about "which host publishes this content?":
--
-- 1. `sites.parent_site_id` — the site a `paths` site is mounted on.
--
--    The meaning of `content_mode` (051) is now:
--
--      'standalone'  the site is deployed on its own (its own Cloudflare Pages
--                    project or Worker): it publishes the website when it declares
--                    no content routes, or just the collections its routes name
--                    when it does. A site with no routes is what builds the
--                    website itself.
--      'paths'       the site is NOT deployed. It is a slice of content that the
--                    site in `parent_site_id` publishes under the prefixes its
--                    content routes name (a collection missing from them keeps the
--                    collection's own `url_prefix`). The parent must be an active
--                    `standalone` site, which is what "the main site" means here.
--
--    Migration 051 classified a site with no content routes as `paths` because it
--    published the website. That is a `standalone` site under the new meaning —
--    it is deployed — so those rows are reclassified here. A `paths` site now has
--    to name its parent, and the operator does that from Admin → Sites.
--
-- 2. `content_sites` — which sites a content item is published by.
--
--    `content.site_id` (038) allows exactly one owner, so a blog post owned by a
--    mounted blog site could not also be published by the main site. The join table
--    makes the assignment a set: an item may be published by several sites, and
--    `content.site_id` stays as the primary/owning site for everything that already
--    reads it (lists, revisions, the admin form's default).
--
--    Existing rows are copied over, so nothing changes for a deployment that never
--    touches the new field. A site also sees the content of the `paths` sites
--    mounted on it, beside its own and the shared rows, which is what makes a
--    mounted site's content show up on the parent host.

ALTER TABLE sites ADD COLUMN parent_site_id TEXT;

CREATE TABLE IF NOT EXISTS content_sites (
  content_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  created_at INTEGER,
  PRIMARY KEY (content_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_content_sites_site ON content_sites (site_id, content_id);

INSERT OR IGNORE INTO content_sites (content_id, site_id, created_at)
SELECT id, site_id, created_at FROM content WHERE site_id IS NOT NULL;

-- The website-building sites are deployed, so they are `standalone` now.
UPDATE sites SET content_mode = 'standalone' WHERE content_mode = 'paths';
