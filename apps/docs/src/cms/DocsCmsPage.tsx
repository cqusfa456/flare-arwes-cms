'use client'

import { LayoutDevelop } from '@/app/docs/develop/LayoutDevelop'
import { CmsDocsNav, type CmsNavDoc, type CmsNavSection } from './CmsDocsNav'

type DocsCmsPageProps = {
  title: string
  contentHtml: string
  metaDescription?: string
  /**
   * Navigation data from the CMS as a JSON string. A string is always
   * serialised into the island's props; passing the arrays directly meant they
   * were dropped (the deployed island had only title/contentHtml), which left
   * the sidebar empty with no runtime error at all.
   */
  navData?: string
  /**
   * Pathname of this page, passed down from the Astro route. The sidebar is a
   * different React root than `AppShell`, so it cannot read the app's router
   * state and needs the value as a prop to highlight the current page.
   */
  pathname?: string
}

const DocsCmsPage = (props: DocsCmsPageProps): JSX.Element => {
  const { title, contentHtml, navData, pathname } = props

  let sections: CmsNavSection[] = []
  let docs: CmsNavDoc[] = []
  if (navData) {
    try {
      const parsed = JSON.parse(navData) as { sections?: CmsNavSection[]; docs?: CmsNavDoc[] }
      sections = parsed.sections ?? []
      docs = parsed.docs ?? []
    } catch {
      // A malformed payload must not take the whole page down: the article is
      // still worth rendering without navigation.
      sections = []
      docs = []
    }
  }

  // Most CMS documents open with their own `# Title`, which the markdown
  // renderer already produced as an `<h1>`. Rendering the wrapper title as well
  // printed the heading twice, so it is only used when the content lacks one.
  const contentHasTitle = /^\s*<h1[\s>]/i.test(contentHtml)

  return (
    <LayoutDevelop
      nav={
        <CmsDocsNav
          sections={sections}
          docs={docs}
          pathname={pathname}
          className="mb-auto"
        />
      }
    >
      {!contentHasTitle && <h1>{title}</h1>}
      <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
    </LayoutDevelop>
  )
}

export { DocsCmsPage }
