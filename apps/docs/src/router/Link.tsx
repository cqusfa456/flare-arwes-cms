import { type AnchorHTMLAttributes, type ReactNode, useCallback } from 'react'

import { useNavigate } from './context'
import { isRoute } from './routes'

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

      if (isInternal && isRoute(href) && !isNewTab && !isModified) {
        event.preventDefault()
        navigate(href)
      }
    },
    [href, target, onClick, navigate]
  )

  return (
    <a {...rest} href={href} target={target} onClick={handleClick}>
      {children}
    </a>
  )
}

export { Link }
