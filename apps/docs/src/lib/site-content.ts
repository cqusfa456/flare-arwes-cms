/**
 * CMS-managed site chrome: menus and page frames.
 *
 * Both come from collections that publish no path of their own:
 *
 *   navigation  a menu, identified by `key`, whose `items` field is a JSON array
 *               of { label, href }. Several coexist — `home` for the front page
 *               and `default` for every other page, for instance.
 *   layouts     a page frame written as an `.astro` file (with a `<slot />`),
 *               identified by `key`. The build wraps a page's content in the
 *               layout it selects, so an author writes content only.
 *
 * A page may name either through its own `nav` / `layout` field.
 */
import { getCollection } from 'astro:content'

export type NavItem = { label: string; href: string }

/** Key of the menu a path uses when the page names none. */
export const defaultNavKey = (pathname: string): string =>
  pathname === '/' || pathname === '' ? 'home' : 'default'

const parseItems = (raw: unknown): NavItem[] => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({ label: String(item.label ?? ''), href: String(item.href ?? '') }))
      .filter((item) => item.label !== '' && item.href !== '')
  } catch {
    console.warn('[navigation] the selected menu has invalid JSON in its items field; ignoring it')
    return []
  }
}

/**
 * Menu for a path: the page's own choice first, then the site rule (home gets
 * `home`, everything else `default`). An empty result means the site's built-in
 * navigation is used.
 */
export const getNavigation = async (pathname: string, pageKey?: string): Promise<NavItem[]> => {
  const entries = await getCollection('navigation')
  const wanted = [pageKey, defaultNavKey(pathname)].filter((key): key is string => !!key)

  for (const key of wanted) {
    const match = entries.find((entry: any) => String(entry.data.key) === key)
    if (match) {
      return parseItems(match.data.items)
    }
  }

  return []
}

/** Source of the layout a page should be wrapped in, or null when there is none. */
export const getLayout = async (
  pageKey?: string
): Promise<{ key: string; astro: string } | null> => {
  const entries = await getCollection('layouts')
  const wanted = [pageKey, 'default'].filter((key): key is string => !!key)

  for (const key of wanted) {
    const match = entries.find((entry: any) => String(entry.data.key) === key)
    const astro = match?.data?.astro
    if (match && typeof astro === 'string' && astro.trim() !== '') {
      return { key, astro }
    }
  }

  return null
}
