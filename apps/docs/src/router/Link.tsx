import { type AnchorHTMLAttributes, type ReactNode, useCallback } from 'react'

import { isRoute } from './routes'
import { useAppBase, useNavigate } from './context'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children?: ReactNode
}

// Client-side navigation link. It is a drop-in replacement for
// `next/link`. Internal links to known routes are intercepted and
// navigated without a full page reload. External links, links with a
// target, and links to unknown routes are not intercepted.
const Link = (props: LinkProps): JSX.Element => {
  const { href, target, onClick, children, ...rest } = props

  const navigate = useNavigate()
  const appBase = useAppBase()

  // On a content-only host the app's own routes live on another site, so a link
  // to one has to be absolute (and therefore a normal page load). The root is
  // excluded: on such a host `/` is the collection's index, served locally.
  const isAppRouteElsewhere = !!appBase && isRoute(href) && href !== '/'
  const resolvedHref =
    isAppRouteElsewhere && href.startsWith('/') ? `${appBase!.replace(/\/+$/, '')}${href}` : href

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)

      if (event.defaultPrevented) {
        return
      }

      const isInternal = href.startsWith('/') && !href.startsWith('//')
      const isNewTab = target !== undefined && target !== '_self'
      const isModified =
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0

      if (isInternal && isRoute(href) && !isNewTab && !isModified && !isAppRouteElsewhere) {
        event.preventDefault()
        navigate(href)
      }
    },
    [href, target, onClick, navigate, isAppRouteElsewhere]
  )

  return (
    <a {...rest} href={resolvedHref} target={target} onClick={handleClick}>
      {children}
    </a>
  )
}

export { Link }
