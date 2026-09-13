-- Migration 047: shared site components
--
-- The pieces of chrome a site repeats on every page — the navigation bar, the
-- footer bar, anything else an author wants to edit — live in the CMS as Astro
-- files, and layouts compose them:
--
--   components  a named Astro snippet, rendered by a layout with
--               <CmsComponent name="nav" />. It is not a page: it publishes no
--               path of its own.
--   layouts     composes components into a page frame and renders <slot />.
--   pages       names the layout it wants, so several layout versions coexist and
--               every page picks one.
--
--   key    short identifier the layout refers to it by (slug), e.g. nav / footer
--   name   label for the admin list
--   astro  the whole component file, compiled by Astro at build time
--
-- Publishing no path keeps it out of the routing: `url_prefix` NULL, like
-- `navigation` and `layouts`.

INSERT OR IGNORE INTO collections (id, name, display_name, description, schema, is_active, created_at, updated_at, url_prefix)
VALUES (
  'components-collection',
  'components',
  'Components',
  'Shared pieces of chrome (navigation bar, footer bar, ...) written as Astro files and composed by layouts.',
  '{"type":"object","properties":{"key":{"type":"slug","title":"Key","required":true,"helpText":"How a layout renders it, e.g. nav or footer"},"name":{"type":"string","title":"Name","required":true,"maxLength":100},"description":{"type":"textarea","title":"Description","maxLength":300},"astro":{"type":"astro","title":"Component (Astro)","helpText":"The component file. It receives the props the layout passes and can use <CmsNav /> for CMS menus."}},"required":["key","name"]}',
  1,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000,
  NULL
);

-- A page names both the menu and the layout version it wants, so the help text
-- now says that layouts are a choice rather than a single frame.
UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"layout":{"type":"slug","title":"Layout","helpText":"Which layout version frames this page, e.g. default or article. Empty uses default."}}}'
)
WHERE name = 'pages';

UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"astro":{"type":"astro","title":"Layout (Astro)","helpText":"The page frame: compose shared components (<CmsComponent name=\"nav\" />) and render <slot />. It receives the props title, pathname and navKey."}}}'
)
WHERE name = 'layouts';
