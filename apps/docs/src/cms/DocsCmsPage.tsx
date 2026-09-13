'use client'

import { Animated, Animator } from '@arwes/react'
import { animate, stagger } from 'motion'

import { LayoutDevelop } from '@/app/docs/develop/LayoutDevelop'
import { CmsAnimator } from './CmsAnimator'
import { CmsDocsNav, type CmsNavDoc, type CmsNavSection } from './CmsDocsNav'
import { stripLeadingTitle } from './content'

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

  // The document's own heading is rendered by this page instead, so it can take
  // part in the enter animation.
  const bodyHtml = stripLeadingTitle(contentHtml, title)

  return (
    <CmsAnimator>
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
        {/*
          The docs layout staggers its children, so the title and the body have
          to be ARWES `Animated` blocks: plain elements used to appear instantly
          while the sidebar and the frames animated in. Inside the body, each
          top-level markdown block fades in on its own, like the app's own
          paragraphs and lists do.
        */}
        <Animator>
          <Animated as="h1" animated={['flicker']}>
            {title}
          </Animated>
        </Animator>

        <Animator>
          <Animated
            as="div"
            animated={{
              transitions: {
                entering: ({ $, duration }) =>
                  animate(
                    $(':scope > *'),
                    { opacity: [0, 1, 0.5, 1] },
                    { duration, delay: stagger(0.02) }
                  ),
                exiting: { opacity: [1, 0, 0.5, 0] }
              }
            }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </Animator>
      </LayoutDevelop>
    </CmsAnimator>
  )
}

export { DocsCmsPage }
