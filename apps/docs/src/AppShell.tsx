'use client'

import { useMemo, type ReactNode } from 'react'
import { Provider, createStore } from 'jotai'

import { Router, usePathname } from '@/router'
import { atomPathname } from '@/router/store'
import { LayoutRoot } from '@/app/LayoutRoot'
import { App } from '@/App'

type AppShellProps = {
  pathname: string
  /**
   * Path of the CMS blog collection, read from its URL prefix at build time.
   * Undefined when the CMS does not route a blog, which hides the link.
   */
  blogPath?: string
  /**
   * Base URL of the main site, when this build is a content-only host (a blog
   * subdomain): the shell's links to the app's own routes have to point there.
   */
  appBaseUrl?: string
  /** Paths this build generated from CMS content; the client router leaves them alone. */
  serverPaths?: string[]
  /** Menu items from the CMS; empty means the shell uses its built-in navigation. */
  navItems?: Array<{ label: string; href: string }>
  /** The page's layout owns the chrome, so the shell renders no menu. */
  hideMenu?: boolean
  children?: ReactNode
}

// Which content the shell shows.
//
// The island's slot holds the page content Astro server-rendered for CMS pages
// and collections; app routes have none, because their content comes from React.
//
// The decision follows the live pathname compared with the one this document was
// built for: the server content belongs to that path only. Deciding from the
// route table alone was wrong twice over — a CMS page can own an app route (the
// front page, or a collection's index on a content-only host), and after a
// client-side navigation the previous page's HTML must not linger.
const PageContent = (props: {
  serverContent?: ReactNode
  initialPathname: string
}): JSX.Element => {
  const pathname = usePathname()

  const normalize = (value: string): string =>
    value.length > 1 ? value.replace(/\/+$/, '') : value

  if (
    props.serverContent === undefined ||
    normalize(pathname) !== normalize(props.initialPathname)
  ) {
    return <App />
  }

  return <>{props.serverContent}</>
}

// The root component of the app rendered as a single Astro island. It
// provides the jotai store with the initial pathname (from the Astro
// static page), the client-side router, and the ARWES layout.
// The `children` are the CMS-managed page content rendered by Astro
// (SSR) and passed through the slot.
const AppShell = (props: AppShellProps): JSX.Element => {
  const { pathname, blogPath, appBaseUrl, serverPaths, navItems, hideMenu, children } = props

  const store = useMemo(() => {
    const store = createStore()
    store.set(atomPathname, pathname)
    return store
  }, [pathname])

  return (
    <Provider store={store}>
      <Router appBaseUrl={appBaseUrl} serverPaths={serverPaths}>
        <LayoutRoot blogPath={blogPath} navItems={navItems} hideMenu={hideMenu}>
          <PageContent serverContent={children} initialPathname={pathname} />
        </LayoutRoot>
      </Router>
    </Provider>
  )
}

export { AppShell }
