'use client'

import { Animator, memo } from '@arwes/react'
import { NavItem, NavList } from '@/ui'

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
  className?: string
}

// Sidebar for CMS-managed documentation. The links come from the CMS (docs +
// docs-sections), not from the app's static route list, so adding a page in the
// admin is enough to make it appear here.
//
// It is built from the same NavItem/NavList primitives as the static app
// navigation, so it keeps the theme colours, the octagon clipped rows, the
// dashed nested list and the flicker animation. The rows used to be plain
// markup with only opacity utilities, which inherited the document colour —
// black text on a black background.
const CmsDocsNav = memo((props: CmsDocsNavProps): JSX.Element => {
  const { docs, sections = [], pathname, className } = props

  const bySection = new Map<string, CmsNavDoc[]>()
  for (const doc of docs) {
    const key = doc.section ?? ''
    const list = bySection.get(key) ?? []
    list.push(doc)
    bySection.set(key, list)
  }

  const byOrder = (a: CmsNavDoc, b: CmsNavDoc): number => (a.order ?? 0) - (b.order ?? 0)

  const groups: Array<{ key: string; label?: string; docs: CmsNavDoc[] }> = []

  for (const section of [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const list = bySection.get(section.slug)
    if (list && list.length > 0) {
      groups.push({ key: section.slug, label: section.name, docs: [...list].sort(byOrder) })
      bySection.delete(section.slug)
    }
  }

  // Anything the section list does not cover is still shown, so content never
  // becomes unreachable just because its section is missing from the CMS.
  for (const [key, list] of bySection) {
    if (list.length > 0) {
      groups.push({ key: key || '_', docs: [...list].sort(byOrder) })
    }
  }

  return (
    <Animator combine manager="stagger" duration={{ stagger: 0.015 }}>
      <NavList className={className}>
        {groups.map((group) => {
          const items = group.docs.map((doc) => (
            <NavItem
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              text={doc.title}
              pathname={pathname}
            />
          ))

          // A group without a name from the CMS still renders its links, just
          // without the parent row.
          return group.label ? (
            <NavItem key={group.key} text={group.label}>
              {items}
            </NavItem>
          ) : (
            items
          )
        })}
      </NavList>
    </Animator>
  )
})

export { CmsDocsNav }
