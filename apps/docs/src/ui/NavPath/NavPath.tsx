import { usePathname } from '@/router'

import { Breadcrumbs, type BreadcrumbsProps } from '../Breadcrumbs'
import { memo } from '@arwes/react'

type NavPathProps = Omit<BreadcrumbsProps, 'items'>

const paths: Record<string, string> = {
  '/': 'Root',
  '/docs': 'Docs',
  '/docs/design': 'Design',
  '/docs/develop': 'Develop',
  '/docs/develop/fundamentals': 'Fundamentals',
  '/docs/develop/vanilla': 'Vanilla',
  '/docs/develop/tailwind': 'Tailwind',
  '/docs/develop/react': 'React',
  '/docs/develop/solid': 'Solid',
  '/docs/develop/svelte': 'Svelte',
  '/docs/community': 'Community',
  '/demos': 'Demos'
}

const NavPath = memo((props: NavPathProps): JSX.Element => {
  const pathname = usePathname()

  const fragments = pathname.split('/').filter(Boolean)

  let pathKey = ''

  const items = fragments
    .map((fragment, index) => {
      if (index === fragments.length - 1) {
        return null
      }

      pathKey = `${pathKey}/${fragment}`
      const pathValue = paths[pathKey]

      if (pathValue) {
        return { href: pathKey, text: pathValue }
      }

      return null
    })
    .filter(Boolean) as BreadcrumbsProps['items']

  return <Breadcrumbs {...props} items={items} />
})

export { NavPath }
