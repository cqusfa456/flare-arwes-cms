'use client'

import { LayoutContent, Nav } from '@/ui'

type LayoutDocsProps = {
  children?: React.ReactNode
}

const LayoutDevelop = (props: LayoutDocsProps): JSX.Element => {
  const { children } = props
  return (
    <LayoutContent left={<Nav className="mb-auto" path="docs" />}>
      <article className="flex flex-col min-w-0 min-h-0 prose prose-sm lg:prose-base">
        {children}
      </article>
    </LayoutContent>
  )
}

export { LayoutDevelop }
