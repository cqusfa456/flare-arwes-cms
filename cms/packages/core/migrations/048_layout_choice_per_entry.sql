-- Migration 048: a layout choice per content entry
--
-- `pages` names the layout version that frames it (migration 046); the
-- documentation and the blog can now do the same. Every content entry in the CMS
-- therefore chooses its own frame, and a new layout version can be published and
-- adopted entry by entry, without touching the ones that keep `default`.
--
-- The field is a key into the `layouts` collection; empty means the site's
-- `default` layout, and a key with no layout falls back to it as well.

UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"layout":{"type":"slug","title":"Layout","helpText":"Which layout version frames this entry, e.g. default or article. Empty uses default."}}}'
)
WHERE name = 'docs';

UPDATE collections
SET schema = json_patch(
  schema,
  '{"properties":{"layout":{"type":"slug","title":"Layout","helpText":"Which layout version frames this entry, e.g. default or article. Empty uses default."}}}'
)
WHERE name = 'blog-posts';
