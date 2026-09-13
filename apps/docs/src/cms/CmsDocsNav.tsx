'use client'

import { memo } from '@arwes/react'

import { Link, usePathname } from '@/router'

export type CmsNavDoc = {
  slug: string
  title: string
  /** Section slug the page belongs to, when the CMS exposes the relation. */
  section?: string
  order?: number
}

export type CmsNavSection = {
  slug: string
  name: string
  order?: number
}

type CmsDocsNavProps = {
  docs: CmsNavDoc[]
  sections?: CmsNavSection[]
  /**
   * Current pathname. This island is a separate React root from `AppShell`, so
   * it does not share that component's jotai store and `usePathname()` alone
   * always reports the atom's initial value. Astro passes the real pathname;
   * the hook stays as the fallback.
   */
  pathname?: string
}

// Sidebar for CMS-managed documentation. The links come from the CMS (docs +
// docs-sections), not from the app's static route list, so adding a page in the
// admin is enough to make it appear here. Rendered with the router's Link, which
// is a real anchor, so a CMS path that the client router does not know still
// opens (with a full page load).
const CmsDocsNav = memo((props: CmsDocsNavProps): JSX.Element => {
  const { docs, sections = [], pathname: pathnameProp } = props
  const pathname = usePathname()

  const bySection = new Map<string, CmsNavDoc[]>()
  for (const doc of docs) {
    const key = doc.section ?? ''
    const list = bySection.get(key) ?? []
    list.push(doc)
    bySection.set(key, list)
  }

  const groups: Array<{ key: string; label?: string; docs: CmsNavDoc[] }> = []

  for (const section of [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const list = bySection.get(section.slug)
    if (list && list.length > 0) {
      groups.push({ key: section.slug, label: section.name, docs: list })
      bySection.delete(section.slug)
    }
  }

  // Anything the section list does not cover is still shown, so content never
  // becomes unreachable just because its section is missing from the CMS.
  for (const [key, list] of bySection) {
    if (list.length > 0) {
      groups.push({ key: key || '_', label: undefined, docs: list })
    }
  }

  const current = (pathnameProp ?? pathname).replace(/\/+$/, '')

  return (
    <nav className="flex flex-col gap-5 w-full text-sm">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          {group.label && (
            <div className="font-bold uppercase tracking-wide opacity-70">{group.label}</div>
          )}
          <ul className="flex flex-col gap-1">
            {[...group.docs]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((doc) => {
                const href = `/docs/${doc.slug}`
                const active = current === href
                return (
                  <li key={doc.slug}>
                    <Link
                      href={href}
                      className={active ? 'underline opacity-100' : 'opacity-80 hover:opacity-100'}
                    >
                      {doc.title}
                    </Link>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </nav>
  )
})

export { CmsDocsNav }
