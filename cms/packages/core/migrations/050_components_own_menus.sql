-- Migration 050: components own their menus, and the admin reads Chinese names
--
-- The navigation bar *is* a component; its menu is what it renders. Keeping menus in
-- a collection of their own made "where do I edit the nav?" a two-step question, so
-- they move into `components`: an entry there may carry markup (`astro`), a menu
-- (`items`), or both. The old rows are copied over and the collection is retired
-- rather than deleted, so nothing is lost if it has to be looked up.
--
-- The second half is the admin's own vocabulary: the collection names an operator
-- reads are set in Chinese (the values are only replaced while they are still the
-- stock English ones, so a rename is never overwritten).

-- 1. A component may carry the menu it renders.
UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"items":{"type":"textarea","title":"Items (JSON)","helpText":"Menu this component renders: [{\"label\":\"Docs\",\"href\":\"/docs/\"}]. Leave empty for a plain component."}}}'
)
WHERE name = 'components';

-- 2. Fold the menus into `components`, key for key.
INSERT INTO content (id, collection_id, slug, title, data, status, published_at, author_id, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  'components-collection',
  menu.slug,
  menu.title,
  menu.data,
  menu.status,
  menu.published_at,
  menu.author_id,
  menu.created_at,
  menu.updated_at
FROM content AS menu
WHERE menu.collection_id = 'navigation-collection'
  AND NOT EXISTS (
    SELECT 1
    FROM content AS existing
    WHERE existing.collection_id = 'components-collection'
      AND existing.slug = menu.slug
  );

-- 3. Retire the collection it came from.
UPDATE collections SET is_active = 0, updated_at = unixepoch() * 1000 WHERE name = 'navigation';

-- 4. The names the admin shows.
UPDATE collections SET display_name = '页面', updated_at = unixepoch() * 1000
WHERE name = 'pages' AND display_name = 'Pages';

UPDATE collections SET display_name = '博客帖子', updated_at = unixepoch() * 1000
WHERE name = 'blog-posts' AND display_name = 'Blog Posts';

UPDATE collections SET display_name = '文档', updated_at = unixepoch() * 1000
WHERE name = 'docs' AND display_name = 'Documentation';

UPDATE collections SET display_name = '文档分组', updated_at = unixepoch() * 1000
WHERE name = 'docs-sections' AND display_name = 'Docs Sections';

UPDATE collections SET display_name = '样式', updated_at = unixepoch() * 1000
WHERE name = 'layouts' AND display_name = 'Layouts';

UPDATE collections SET display_name = '组件', updated_at = unixepoch() * 1000
WHERE name = 'components' AND display_name = 'Components';
