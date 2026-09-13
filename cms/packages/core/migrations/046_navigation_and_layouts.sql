-- Migration 046: CMS-managed navigation and layouts
--
-- Navigation: the site's menus come from the CMS instead of being hardcoded in the
-- header. Several menus can coexist and a page picks one by key — typically `home`
-- for the front page and `default` for everything else.
--
--   key    short identifier the site selects the menu by (slug)
--   name   label for the admin list
--   items  JSON array: [{ "label": "Docs", "href": "/docs/" }, ...]
--
-- Layouts: the frame a page is rendered in, as an `.astro` file with a `<slot />`
-- and the props `title` / `pathname`. The build wraps a page's content in the
-- layout it selects, so an author writes only the content and the site's style
-- stays consistent. A page that carries its own frontmatter is left alone.
--
--   key    identifier the site selects the layout by (slug); `default` is the
--          fallback when a page names none
--   astro  the whole layout file, compiled by Astro at build time
--
-- Neither collection is routed on its own (`url_prefix` NULL): they configure the
-- site rather than publish pages.

INSERT OR IGNORE INTO collections (id, name, display_name, description, schema, is_active, created_at, updated_at, url_prefix)
VALUES (
  'navigation-collection',
  'navigation',
  'Navigation',
  'Menus rendered by the site header. Several can coexist; a page picks one by key.',
  '{"type":"object","properties":{"key":{"type":"slug","title":"Key","required":true,"helpText":"How the site selects this menu, e.g. home or default"},"name":{"type":"string","title":"Name","required":true,"maxLength":100},"items":{"type":"textarea","title":"Items (JSON)","helpText":"JSON array of menu entries: [{\"label\":\"Docs\",\"href\":\"/docs/\"}]"}},"required":["key","name"]}',
  1,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000,
  NULL
);

INSERT OR IGNORE INTO collections (id, name, display_name, description, schema, is_active, created_at, updated_at, url_prefix)
VALUES (
  'layouts-collection',
  'layouts',
  'Layouts',
  'Page frames written as Astro files. A page is wrapped in the layout it selects, so authors write content only.',
  '{"type":"object","properties":{"key":{"type":"slug","title":"Key","required":true,"helpText":"How a page selects this layout; default is the fallback"},"name":{"type":"string","title":"Name","required":true,"maxLength":100},"description":{"type":"textarea","title":"Description","maxLength":300},"astro":{"type":"astro","title":"Layout (Astro)","helpText":"The layout file: it renders <slot /> and receives the props title and pathname."}},"required":["key","name"]}',
  1,
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000,
  NULL
);

-- A page may name the menu and the layout it wants; both fall back by key when
-- unset (menu `home` on the front page, `default` elsewhere; layout `default`).
-- They live in the page's own data, so they are declared on the `pages` schema.
UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"nav":{"type":"slug","title":"Navigation","helpText":"Key of the menu to render, e.g. home or default. Empty uses the site rule."},"layout":{"type":"slug","title":"Layout","helpText":"Key of the layout to wrap this page in. Empty uses default."}}}'
)
WHERE name = 'pages';
