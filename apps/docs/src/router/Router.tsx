import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAtom } from 'jotai'

import { atomPathname } from './store'
import { NavigateContext } from './context'
import { isRoute } from './routes'

type RouterProps = {
  children: ReactNode
}

// Normalize a pathname: remove trailing slashes (except for the root path)
// so it matches the app routes table.
const normalizePathname = (pathname: string): string => {
  if (pathname === '/') {
    return pathname
  }
  return pathname.replace(/\/+$/, '')
}

// Client-side router. It keeps the current pathname in a jotai atom and
// provides a `navigate` function to change it without a full page reload.
// It also listens to the browser `popstate` event for back/forward
// navigation. The page content is rendered by the App component which
// switches the page component based on the current pathname.
//
// Routes not in the static routes table (e.g. CMS-managed pages) are
// navigated with a full page load since their content is only available
// in the server-rendered HTML.
const Router = (props: RouterProps): JSX.Element => {
  const { children } = props

  const [pathname, setPathname] = useAtom(atomPathname)

  const [isReady, setIsReady] = useState(false)

  // Initialize the pathname from the browser location on mount.
  useEffect(() => {
    setPathname(normalizePathname(window.location.pathname))
    setIsReady(true)
  }, [setPathname])

  // Listen to the browser back/forward navigation.
  useEffect(() => {
    const onPopState = (): void => {
      setPathname(normalizePathname(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [setPathname])

  // Scroll to top on pathname change.
  useEffect(() => {
    if (isReady) {
      window.scrollTo(0, 0)
    }
  }, [pathname, isReady])

  const navigate = useCallback(
    (href: string) => {
      const normalized = normalizePathname(href)
      const current = normalizePathname(window.location.pathname)

      if (normalized === current) {
        return
      }

      // CMS-managed pages are not in the static routes table. They are
      // server-rendered, so navigate with a full page load.
      if (!isRoute(normalized)) {
        window.location.href = normalized
        return
      }

      window.history.pushState({}, '', normalized)
      setPathname(normalized)
    },
    [setPathname]
  )

  const navigateValue = useMemo(() => navigate, [navigate])

  return <NavigateContext.Provider value={navigateValue}>{children}</NavigateContext.Provider>
}

export { Router }
