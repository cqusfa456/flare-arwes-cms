import { createContext, useContext } from 'react'

// Navigation function provided by the Router component. It performs a
// client-side navigation to the given path without reloading the page.
type NavigateFn = (href: string) => void

const NavigateContext = createContext<NavigateFn>(() => {})

const useNavigate = (): NavigateFn => useContext(NavigateContext)

/**
 * Base URL of the site that serves the app's own routes.
 *
 * A content-only host (for example a blog subdomain) does not generate those
 * routes, so links to them have to point at the main site instead. Undefined on
 * the main site, where every link is local.
 */
const AppBaseContext = createContext<string | undefined>(undefined)

const useAppBase = (): string | undefined => useContext(AppBaseContext)

export { NavigateContext, useNavigate, AppBaseContext, useAppBase }
