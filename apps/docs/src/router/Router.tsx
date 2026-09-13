import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useAtom } from 'jotai'

import { atomPathname } from './store'
import { AppBaseContext, NavigateContext } from './context'
import { isRoute } from './routes'

type RouterProps = {
  children: ReactNode
  /**
   * Base URL of the site that serves the app's own routes, when this build is a
   * content-only host (see `Link`). Undefined on the main site.
   */
  appBaseUrl?: string
  /**
   * Paths this build generated from CMS content. They may sit on an app route
   * (a CMS page can own the front page), so the client router must not take them
   * over: navigating to one is a full page load of the CMS page.
   */
  serverPaths?: string[]
}

// Normalize a pathname: remove trailing slashes (except for the root path)
// so it matches the app routes table.
const normalizePathname = (pathname: string): string => {
  if (pathname === '/') {
    return pathname
  }
  return pathname.replace(/\/+$/, '')
}

/**
 * Whether the current page is rendered outside the app shell, so a link to it (or
 * from it) has to be a document navigation.
 */
const isExternalHref = (href: string): boolean => !href.startsWith('/') || href.startsWith('//')

/**
 * Swap the page inside a view transition when the browser supports it.
 *
 * The whole page is faded by the browser instead of being replaced in one frame,
 * which is what makes the change read as a transition rather than a jump — the same
 * animation a document navigation gets from the `@view-transition` rule in the
 * layout. `flushSync` is required: React commits asynchronously, and the transition
 * would otherwise capture the DOM before the new page is in it.
 */
const commitWithTransition = (commit: () => void): void => {
  const startViewTransition = (
    document as Document & { startViewTransition?: (callback: () => void) => unknown }
  ).startViewTransition

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (typeof startViewTransition !== 'function' || prefersReducedMotion) {
    commit()
    return
  }

  startViewTransition.call(document, () => {
    flushSync(commit)
  })
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
  const { children, appBaseUrl, serverPaths } = props

  const serverPathSet = useMemo(
    () => new Set((serverPaths ?? []).map(normalizePathname)),
    [serverPaths]
  )

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
      commitWithTransition(() => setPathname(next))
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

      // CMS-generated paths are server-rendered, even when they sit on an app
      // route: navigating to one has to load the page.
      if (serverPathSet.has(normalized)) {
        window.location.href = normalized
        return
      }

      // CMS-managed pages are not in the static routes table. They are
      // server-rendered, so navigate with a full page load.
      if (!isRoute(normalized)) {
        window.location.href = normalized
        return
      }

      commitWithTransition(() => {
        window.history.pushState({}, '', normalized)
        setPathname(normalized)
      })
    },
    [setPathname, serverPathSet]
  )

  const navigateValue = useMemo(() => navigate, [navigate])

  // The site's chrome is rendered by Astro (the navigation bar, the footer bar, a
  // page's own markup), so its links are plain anchors, not `Link` components: left
  // to the browser, every one of them would reload the whole document. They go
  // through the router instead, which navigates an app route in place and lets the
  // browser load a server page (the view transition animates either way).
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      // `Link` already handled it, or the user asked for a new tab/window.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      const href = anchor?.getAttribute('href') ?? ''

      if (
        !anchor ||
        !href ||
        isExternalHref(href) ||
        anchor.target ||
        anchor.hasAttribute('download')
      ) {
        return
      }

      event.preventDefault()
      navigate(href)
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate])

  return (
    <AppBaseContext.Provider value={appBaseUrl}>
      <NavigateContext.Provider value={navigateValue}>{children}</NavigateContext.Provider>
    </AppBaseContext.Provider>
  )
}

export { Router }
