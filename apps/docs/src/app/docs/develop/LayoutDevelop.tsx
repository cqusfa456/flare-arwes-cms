'use client'

import { LayoutContent, Nav } from '@/ui'

type LayoutDocsProps = {
  children?: React.ReactNode
  /** Sidebar to use instead of the app's static docs navigation. */
  nav?: React.ReactNode
}

const LayoutDevelop = (props: LayoutDocsProps): JSX.Element => {
  const { children, nav } = props
  return (
    <LayoutContent left={nav ?? <Nav className="mb-auto" path="docs" />}>
      <article className="flex flex-col min-w-0 min-h-0 prose prose-sm lg:prose-base">
        {children}
      </article>
    </LayoutContent>
  )
}

export { LayoutDevelop }
