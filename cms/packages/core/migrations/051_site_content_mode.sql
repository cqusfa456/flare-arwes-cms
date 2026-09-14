-- Migration 051: the mode a site publishes in
--
-- Two ways to answer "where does a collection live":
--
--   'paths'       one site serves the collections it knows at their own prefixes, so
--                 the blog is /blog and the documentation is /docs on the same host.
--   'standalone'  the site is a host of its own: it publishes the collections in its
--                 content routes, usually at the root, and the other sites link to it.
--
-- The rows that exist are classified from what they already do: a site with content
-- routes publishes specific collections (standalone), one without them publishes
-- everything at its own prefixes (paths).

ALTER TABLE sites ADD COLUMN content_mode TEXT;

UPDATE sites SET content_mode = CASE
  WHEN content_routes IS NULL OR content_routes = '' THEN 'paths'
  ELSE 'standalone'
END
WHERE content_mode IS NULL;
