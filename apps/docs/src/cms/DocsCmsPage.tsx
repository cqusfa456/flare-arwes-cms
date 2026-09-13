'use client'

import { LayoutDevelop } from '@/app/docs/develop/LayoutDevelop'

type DocsCmsPageProps = {
  title: string
  contentHtml: string
  metaDescription?: string
}

// Renders a CMS-managed documentation page inside the same layout the site's own
// /docs pages use — left navigation plus the prose article — so CMS content does
// not look like a different site. The markdown is rendered to HTML at build time
// and passed in as a prop; pages managed as CMS *pages* keep using CmsPage.
const DocsCmsPage = (props: DocsCmsPageProps): JSX.Element => {
  const { title, contentHtml } = props

  return (
    <LayoutDevelop>
      <h1>{title}</h1>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </LayoutDevelop>
  )
}

export { DocsCmsPage }
