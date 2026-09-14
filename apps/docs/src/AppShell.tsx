'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Provider, createStore } from 'jotai'

import { Router, usePathname } from '@/router'
import { atomPathname } from '@/router/store'
import { CONTENT_ELEMENT_ID } from '@/lib/page-content'
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
  /** Links for the right-hand side from the CMS; empty means the built-in links. */
  actionItems?: Array<{ label: string; href: string; icon?: string }>
  /** Whether the site publishes a logo component, which the header shows. */
  logoContent?: boolean
  /**
   * The site's navigation bar, rendered from the CMS `nav` component by the site
   * layout and placed in the header. Undefined falls back to `navItems`.
   */
  nav?: ReactNode
  /** The page's layout owns the chrome, so the shell renders no menu. */
  hideMenu?: boolean
  /**
   * Whether the slot holds the whole content for this path (a CMS page or a
   * collection index). When it does not, the path is one of the app's own routes
   * and the app renders it.
   */
  hasServerContent?: boolean
  children?: ReactNode
}

// Which content the shell shows.
//
// The island's slot holds the frame Astro rendered for this page — the layout the
// page selected, with the site's chrome in it — and, in its content region, the
// markup Astro rendered for the page itself.
//
// The server markup belongs to the path this document was built for, and only to
// it: after a client-side navigation the previous page's content must not linger.
// When it does not apply, the app renders the route — into the frame's content
// region, so the chrome stays and only the content changes.
const PageContent = (props: {
  serverContent?: ReactNode
  initialPathname: string
  hasServerContent: boolean
}): JSX.Element => {
  const pathname = usePathname()
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null)

  // The marker is server-rendered, so it only exists after mount.
  useEffect(() => {
    setContentElement(document.getElementById(CONTENT_ELEMENT_ID))
  }, [])

  const normalize = (value: string): string =>
    value.length > 1 ? value.replace(/\/+$/, '') : value

  const showsServerContent =
    props.hasServerContent && normalize(pathname) === normalize(props.initialPathname)

  return (
    <>
      {props.serverContent}
      {!showsServerContent && contentElement ? createPortal(<App />, contentElement) : null}
    </>
  )
}

// The root component of the app rendered as a single Astro island. It
// provides the jotai store with the initial pathname (from the Astro
// static page), the client-side router, and the ARWES layout.
// The `children` are the CMS-managed page content rendered by Astro
// (SSR) and passed through the slot.
const AppShell = (props: AppShellProps): JSX.Element => {
  const {
    pathname,
    blogPath,
    appBaseUrl,
    serverPaths,
    navItems,
    nav,
    actionItems,
    logoContent,
    hideMenu,
    hasServerContent,
    children
  } = props

  const store = useMemo(() => {
    const store = createStore()
    store.set(atomPathname, pathname)
    return store
  }, [pathname])

  // The page frame waited for the shell (the `app-intro` rule in the layout keeps it
  // invisible until then): lift the hold on the first frame after mount, so the
  // chrome the shell animates in and the page itself arrive together.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.documentElement.classList.remove('app-intro')
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <Provider store={store}>
      <Router appBaseUrl={appBaseUrl} serverPaths={serverPaths}>
        <LayoutRoot
          blogPath={blogPath}
          navItems={navItems}
          navContent={nav}
          actionItems={actionItems}
          hasLogoContent={logoContent}
          hideMenu={hideMenu}
        >
          <PageContent
            serverContent={children}
            initialPathname={pathname}
            hasServerContent={!!hasServerContent}
          />
        </LayoutRoot>
      </Router>
    </Provider>
  )
}

export { AppShell }
