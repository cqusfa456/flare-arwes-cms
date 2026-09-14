-- Migration 053: the site assignment is the publication control
--
-- `content_sites` (052) made the assignment a set, but "assigned to no site" still
-- meant "shared": the scope read `site_id IS NULL` as "every site may read this".
-- The set is now the whole story, and the two states are:
--
--   assigned to one or more sites   published by those sites (someone checking every
--                                   box is how "every site" is expressed)
--   assigned to no site             published nowhere: the item exists in the CMS and
--                                   is visible in the admin, and no site's build or
--                                   API read returns it
--
-- That makes the default in the content form — nothing checked — mean "not published
-- yet", which is what an author expects before they choose where an item goes.
--
-- The rows that were shared have to keep reaching the sites that already render them:
-- the chrome (layouts, components, pages) is read by every build, so every active site
-- is assigned to it here. After this migration nothing relies on `site_id IS NULL`, so
-- the column stays only as the primary/owning site that the admin and the revisions
-- already read.

-- Rows that predate the assignment table and name an owner.
INSERT OR IGNORE INTO content_sites (content_id, site_id, created_at)
SELECT id, site_id, COALESCE(created_at, 0) FROM content WHERE site_id IS NOT NULL;

-- Rows that were shared: they were readable by every site, so every active site is
-- recorded as publishing them.
INSERT OR IGNORE INTO content_sites (content_id, site_id, created_at)
SELECT c.id, s.id, COALESCE(c.created_at, 0)
FROM content c
CROSS JOIN sites s
WHERE c.site_id IS NULL AND s.is_active = 1;
