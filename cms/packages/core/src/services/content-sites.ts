/**
 * Content ↔ sites assignment (migration 052).
 *
 * `content.site_id` (038) gives an item one owner, which is what the admin list, the
 * revisions and every existing query read. A site can also be a `paths` site mounted
 * on a parent, and the parent publishes that site's content — so an item has to be
 * able to belong to more than one site.
 *
 * `content_sites` is that set, and `content.site_id` stays as its first member (the
 * primary/owning site), so nothing that predates this needs to change. Every write
 * goes through {@link assignContentSites}, which keeps the two in step.
 */

/**
 * The sites an item is published by, primary first. An empty list means it is published
 * nowhere: the assignment is the publication control (migration 053).
 */
export async function listContentSiteIds(db: D1Database, contentId: string): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT site_id FROM content_sites WHERE content_id = ? ORDER BY created_at ASC, site_id ASC')
    .bind(contentId)
    .all()

  return (results ?? []).map((row) => String((row as { site_id: unknown }).site_id))
}

/**
 * Replace an item's site assignment.
 *
 * The primary site (the first value) is mirrored onto `content.site_id`. An empty list
 * assigns the item to no site, which publishes it nowhere — the admin still lists it, and
 * no site's build or API read returns it.
 */
export async function assignContentSites(
  db: D1Database,
  contentId: string,
  siteIds: string[],
  now: number = Date.now()
): Promise<string | null> {
  const unique = [...new Set(siteIds.filter((id) => typeof id === 'string' && id.trim() !== ''))]

  await db.prepare('DELETE FROM content_sites WHERE content_id = ?').bind(contentId).run()

  for (const siteId of unique) {
    await db
      .prepare('INSERT OR IGNORE INTO content_sites (content_id, site_id, created_at) VALUES (?, ?, ?)')
      .bind(contentId, siteId, now)
      .run()
  }

  const primary = unique[0] ?? null
  await db
    .prepare('UPDATE content SET site_id = ? WHERE id = ?')
    .bind(primary, contentId)
    .run()

  return primary
}

/**
 * Resolve submitted site references (ids or slugs) into ids.
 *
 * Returns the unknown values instead of throwing so each caller can answer with its
 * own error shape; the order given is kept, because the first one is the owner.
 */
export async function resolveContentSiteIds(
  db: D1Database,
  values: unknown[]
): Promise<{ siteIds: string[]; unknown: string[] }> {
  const siteIds: string[] = []
  const unknown: string[] = []

  for (const value of values) {
    const requested = typeof value === 'string' ? value.trim() : ''
    if (requested === '') continue

    const row = await db
      .prepare('SELECT id FROM sites WHERE slug = ? OR id = ? LIMIT 1')
      .bind(requested, requested)
      .first()

    if (!row) {
      unknown.push(requested)
      continue
    }

    const id = String((row as { id: unknown }).id)
    if (!siteIds.includes(id)) siteIds.push(id)
  }

  return { siteIds, unknown }
}

/**
 * Read the site list a write asked for.
 *
 * Accepts `siteIds: string[]`, a single `siteId`/`site`, or the `''`/`null`/`[]` that
 * means "assigned to no site", so every write path (JSON API and admin form) can express it.
 */
export function readSubmittedSiteRefs(body: Record<string, unknown>): unknown[] | null {
  const raw = body.siteIds ?? body.site_ids ?? body.sites
  if (raw === undefined) {
    const single = body.siteId ?? body.site_id ?? body.site
    return single === undefined ? null : [single]
  }
  return Array.isArray(raw) ? raw : [raw]
}
