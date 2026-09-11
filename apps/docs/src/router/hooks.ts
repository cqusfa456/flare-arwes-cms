import { useEffect, useState } from 'react'
import { useAtom } from 'jotai'

import { atomPathname } from './store'
import { useNavigate } from './context'

// React hook to get the current pathname of the app. It is a drop-in
// replacement for `next/navigation`'s `usePathname`.
const usePathname = (): string => {
  const [pathname] = useAtom(atomPathname)
  return pathname
}

// React hook to get a router object with a `push` method. It is a drop-in
// replacement for `next/navigation`'s `useRouter`.
const useRouter = (): { push: (href: string) => void } => {
  const navigate = useNavigate()
  return { push: navigate }
}

// React hook to get the current pathname of the app. It is a drop-in
// replacement for `next/navigation`'s `usePathname` but it also listens to
// the browser `popstate` event so it works outside of the Router component.
const usePathnameBrowser = (): string => {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = (): void => {
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return pathname
}

export { usePathname, useRouter, usePathnameBrowser }
