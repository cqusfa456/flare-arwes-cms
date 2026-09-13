'use client'

import { Animated, Animator } from '@arwes/react'
import { animate, stagger } from 'motion'

import { CmsAnimator } from './CmsAnimator'
import { stripLeadingTitle } from './content'

type BlogPostPageProps = {
  title: string
  contentHtml: string
  publishedAt?: string
  metaDescription?: string
}

// Blog presentation for CMS *pages*: no sidebar, a single readable column. Docs
// keep the sidebar layout (see DocsCmsPage); this is the "page"-shaped content
// rendered as a post.
//
// Colours come from the theme palette: the document has no text colour of its
// own, so anything left unstyled inherits black — invisible on the dark
// background. Headings use the same colour the docs prose uses
// (`primary.main(3)`), links and meta use the muted theme tones.
const BlogPostPage = (props: BlogPostPageProps): JSX.Element => {
  const { title, contentHtml, publishedAt } = props

  // The page renders the title itself, so the document's own heading is dropped
  // to avoid printing it twice.
  const bodyHtml = stripLeadingTitle(contentHtml, title)

  return (
    <CmsAnimator>
      {/*
        One stagger group, in reading order: title, then the publish date, then
        the body — each top-level markdown block fading in on its own. This used
        to be a nested `sequence`, which animated the date first and only then
        the title (the title lives in the document body).
      */}
      <Animator combine>
        <div className="flex-1 overflow-y-auto flex p-4 min-w-0 min-h-0 md:p-8">
          <div className="relative flex flex-col gap-6 m-auto w-full min-w-0 min-h-0 max-w-screen-lg">
            <Animator combine manager="stagger" duration={{ stagger: 0.06 }}>
              <Animator>
                <Animated as="h1" className="font-header text-size-2 text-primary-main-3" animated={['flicker']}>
                  {title}
                </Animated>
              </Animator>

              {publishedAt && (
                <Animator>
                  <Animated
                    as="p"
                    className="font-code text-size-10 text-primary-low-2"
                    animated={['flicker']}
                  >
                    {publishedAt}
                  </Animated>
                </Animator>
              )}

              <Animator>
                <Animated
                  as="article"
                  className="prose prose-sm lg:prose-base max-w-none"
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
            </Animator>
          </div>
        </div>
      </Animator>
    </CmsAnimator>
  )
}

export { BlogPostPage }
