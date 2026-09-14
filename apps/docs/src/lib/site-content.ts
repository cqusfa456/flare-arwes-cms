/**
 * CMS-managed site chrome: menus, shared components and page frames.
 *
 * All of them are entries of collections that publish no path of their own:
 *
 *   components  a piece a site repeats on every page, written as an `.astro` file
 *               (Admin → Content → Components) and identified by `key`: the
 *               navigation bar, the footer bar, ... A component may also carry the
 *               menu it renders, as an `items` field holding a JSON array of
 *               { label, href }; that is how the bars get their links, and several
 *               menus coexist — `home` for the front page, `default` elsewhere.
 *   layouts     a page frame written as an `.astro` file (with a `<slot />`),
 *               identified by `key`. The build wraps a page's content in the layout
 *               it selects, so an author writes content only.
 *
 * A page may name either through its own `nav` / `layout` field.
 */
import { getCollection } from 'astro:content'

export type NavItem = {
  label: string
  href: string
  /** Icon the shell should show, e.g. `github`; empty renders the label only. */
  icon?: string
}

/** Key of the menu a path uses when the page names none. */
export const defaultNavKey = (pathname: string): string =>
  pathname === '/' || pathname === '' ? 'home' : 'default'

const toItems = (parsed: unknown): NavItem[] =>
  (Array.isArray(parsed) ? parsed : [parsed])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      label: String(item.label ?? ''),
      href: String(item.href ?? ''),
      icon: typeof item.icon === 'string' && item.icon ? item.icon : undefined
    }))
    .filter((item) => item.label !== '' && item.href !== '')

/**
 * Read a menu's `items` field.
 *
 * The field is JSON, and the CMS field is a plain textarea, so hand-editing it is
 * normal: a single object (`{...}`) and a list that lost its enclosing brackets
 * (`{...},{...}`) are both read as the menu the author meant, rather than silently
 * falling back to the built-in one.
 */
const parseItems = (raw: unknown): NavItem[] => {
  if (Array.isArray(raw)) {
    return toItems(raw)
  }
  if (typeof raw !== 'string' || raw.trim() === '') {
    return []
  }

  const text = raw.trim()
  const shapes = [text]
  if (!text.startsWith('[') && text.includes('{')) {
    shapes.push(`[${text}]`)
  }

  for (const shape of shapes) {
    try {
      return toItems(JSON.parse(shape) as unknown)
    } catch {
      // Try the next shape.
    }
  }

  console.warn('[navigation] the selected menu has invalid JSON in its items field; ignoring it')
  return []
}

/**
 * Menu for a path: the page's own choice first, then the site rule (home gets
 * `home`, everything else `default`). An empty result means the site's built-in
 * navigation is used.
 *
 * Menus are components that carry an `items` field; a component with markup only is
 * not a menu and is skipped.
 */
export const getNavigation = async (pathname: string, pageKey?: string): Promise<NavItem[]> => {
  const entries = await getCollection('components')
  const wanted = [pageKey, defaultNavKey(pathname)].filter((key): key is string => !!key)

  for (const key of wanted) {
    const match = entries.find((entry: any) => String(entry.data.key) === key)
    if (match && match.data.items !== undefined && match.data.items !== null && match.data.items !== '') {
      return parseItems(match.data.items)
    }
  }

  return []
}

/**
 * A named menu, wherever the page is: the header's own links are the same on every
 * page, so they are read by key rather than by the path rule.
 */
export const getMenu = async (key: string): Promise<NavItem[]> => {
  const entries = await getCollection('components')
  const match = entries.find((entry: any) => String(entry.data.key) === key)
  return match && match.data.items !== undefined && match.data.items !== null
    ? parseItems(match.data.items)
    : []
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
