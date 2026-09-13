-- Migration 044: Astro pages
--
-- A `pages` entry can now hold a whole `.astro` file's source in an `astro`
-- field (the astro-editor plugin provides the editor for it). The website build
-- writes every published page that has one to a real `.astro` file and lets Astro
-- compile it, so a CMS page can use layouts, components, imports and expressions
-- exactly like a hand-written page.
--
-- `content` (markdown) is kept: a page without `astro` keeps rendering through
-- the markdown path, which is what entries created before this column had.
-- `json_patch` merges into the existing schema, so running it again is a no-op and
-- any other field changes are preserved.

UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"astro":{"type":"astro","title":"Astro","helpText":"The complete .astro file: frontmatter, markup and expressions. The build writes it to a real page file."}}}'
)
WHERE name = 'pages';
