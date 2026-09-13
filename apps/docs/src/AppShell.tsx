'use client'

import { useMemo, type ReactNode } from 'react'
import { Provider, createStore } from 'jotai'

import { Router, usePathname } from '@/router'
import { isRoute } from '@/router/routes'
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
  children?: ReactNode
}

// Which content the shell shows. The island's slot holds the page content Astro
// server-rendered for CMS and blog pages; app routes have none, because their
// content comes from React.
//
// The choice has to follow the *live* pathname rather than the one the document
// was loaded with. Deciding once from the `children` prop was wrong: after a
// client-side navigation from a CMS page to an app route the slot element still
// existed, so `<App />` never rendered and the app page came up empty (its
// title effect never ran either).
const PageContent = (props: { serverContent?: ReactNode }): JSX.Element => {
  const pathname = usePathname()

  if (props.serverContent === undefined || isRoute(pathname)) {
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
  const { pathname, blogPath, children } = props

  const store = useMemo(() => {
    const store = createStore()
    store.set(atomPathname, pathname)
    return store
  }, [pathname])

  return (
    <Provider store={store}>
      <Router>
        <LayoutRoot blogPath={blogPath}>
          <PageContent serverContent={children} />
        </LayoutRoot>
      </Router>
    </Provider>
  )
}

export { AppShell }
