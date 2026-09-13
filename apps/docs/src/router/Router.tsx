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

// Astro server-renders the content of CMS and blog pages into an
// `<astro-slot>` element inside the AppShell island. App routes render their
// content from React instead and never have slot content, so switching to one
// has to discard the page being left behind. Those nodes are not React-managed,
// so nothing else removes them: visiting /blog used to leave the blog list
// visible on every route navigated to afterwards, under the new URL.
const clearServerRenderedPage = (): void => {
  for (const slot of document.querySelectorAll('astro-slot')) {
    slot.replaceChildren()
  }
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
      const next = normalizePathname(window.location.pathname)
      // An entry the app did not render itself (a CMS or blog page) has its
      // content only in the server HTML, and no copy of it is left in the
      // document once the app navigated away. Reload so it renders correctly.
      if (!isRoute(next)) {
        window.location.reload()
        return
      }
      setPathname(next)
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
      clearServerRenderedPage()
      setPathname(normalized)
    },
    [setPathname]
  )

  const navigateValue = useMemo(() => navigate, [navigate])

  return <NavigateContext.Provider value={navigateValue}>{children}</NavigateContext.Provider>
}

export { Router }
