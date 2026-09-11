import { createContext, useContext } from 'react'

// Navigation function provided by the Router component. It performs a
// client-side navigation to the given path without reloading the page.
type NavigateFn = (href: string) => void

const NavigateContext = createContext<NavigateFn>(() => {})

const useNavigate = (): NavigateFn => useContext(NavigateContext)

export { NavigateContext, useNavigate }
