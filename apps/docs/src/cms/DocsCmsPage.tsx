'use client'

import { LayoutDevelop } from '@/app/docs/develop/LayoutDevelop'
import { CmsDocsNav, type CmsNavDoc, type CmsNavSection } from './CmsDocsNav'

type DocsCmsPageProps = {
  title: string
  contentHtml: string
  metaDescription?: string
  /** Navigation data from the CMS, injected at build time. */
  navSections?: CmsNavSection[]
  navDocs?: CmsNavDoc[]
}

// Renders a CMS-managed documentation page inside the site's docs layout, with a
// sidebar built from the CMS (docs + docs-sections) instead of the app's static
// route list.
const DocsCmsPage = (props: DocsCmsPageProps): JSX.Element => {
  const { title, contentHtml, navSections, navDocs } = props

  return (
    <LayoutDevelop nav={<CmsDocsNav sections={navSections} docs={navDocs ?? []} />}>
      <h1>{title}</h1>
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </LayoutDevelop>
  )
}

export { DocsCmsPage }
