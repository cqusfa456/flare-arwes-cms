-- Migration 042: Per-collection URL prefix
--
-- Why this exists
-- ---------------
-- The path a collection's entries are published under used to live in the site's
-- own code (documentation under /docs, pages under /blog), so moving a content
-- type meant editing and redeploying the site. Recording it on the collection
-- makes it a CMS setting: an editor changes it in Admin -> Collections and the
-- next build generates the paths from it.
--
--   ''       entries are published at the site root (e.g. /about)
--   '/docs'  entries are published under that prefix (e.g. /docs/quick-start)
--   NULL     the collection is not routed on its own (e.g. docs-sections)
--
-- A multi-segment prefix ("/blog/2026") works too: the entry slug is appended to
-- whatever prefix is set.

ALTER TABLE collections ADD COLUMN url_prefix TEXT;

-- Backfill the collections this deployment ships with, so an installation that
-- already has content keeps serving the URLs it already serves.
UPDATE collections SET url_prefix = '/docs' WHERE name = 'docs' AND url_prefix IS NULL;
UPDATE collections SET url_prefix = '/blog' WHERE name IN ('blog', 'blog-posts') AND url_prefix IS NULL;
UPDATE collections SET url_prefix = '' WHERE name = 'pages' AND url_prefix IS NULL;
