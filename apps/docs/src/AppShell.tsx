'use client'

import { useMemo, type ReactNode } from 'react'
import { Provider, createStore } from 'jotai'

import { Router } from '@/router'
import { atomPathname } from '@/router/store'
import { LayoutRoot } from '@/app/LayoutRoot'
import { App } from '@/App'

type AppShellProps = {
  pathname: string
  children?: ReactNode
}

// The root component of the app rendered as a single Astro island. It
// provides the jotai store with the initial pathname (from the Astro
// static page), the client-side router, and the ARWES layout.
// The `children` are the CMS-managed page content rendered by Astro
// (SSR) and passed through the slot.
const AppShell = (props: AppShellProps): JSX.Element => {
  const { pathname, children } = props

  const store = useMemo(() => {
    const store = createStore()
    store.set(atomPathname, pathname)
    return store
  }, [pathname])

  return (
    <Provider store={store}>
      <Router>
        <LayoutRoot>{children ?? <App />}</LayoutRoot>
      </Router>
    </Provider>
  )
}

export { AppShell }
