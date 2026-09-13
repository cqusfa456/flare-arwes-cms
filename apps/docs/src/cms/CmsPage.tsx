'use client'

import { Animator, Animated, Text, cx } from '@arwes/react'

import { Hr } from '@/ui'
import { CmsAnimator } from './CmsAnimator'

type CmsPageProps = {
  title: string
  contentHtml: string
  metaDescription?: string
}

// Renders a page managed by the Sci-Fi CMS admin. The markdown content
// is rendered to HTML at build time by the Astro page and passed here
// as a prop. The ARWES animators provide the sci-fi enter effects.
const CmsPage = (props: CmsPageProps): JSX.Element => {
  const { title, contentHtml, metaDescription } = props

  return (
    <CmsAnimator>
      <Animator combine manager="sequence">
        <div className="flex-1 overflow-y-auto flex p-4 min-w-0 min-h-0 md:p-8">
          <Animator combine>
            <div className="relative flex flex-col gap-8 m-auto min-w-0 min-h-0 max-w-screen-xl">
              <Animator combine manager="stagger">
                <article className="flex flex-col gap-6 prose prose-sm lg:prose-base lg:gap-8">
                  <Animator>
                    <Text as="h1" className="!m-0" fixed>
                      {title}
                    </Text>
                  </Animator>

                  {metaDescription && (
                    <Animator>
                      <Animated
                        as="p"
                        className="text-pretty text-primary-low-3"
                        animated={['flicker']}
                      >
                        {metaDescription}
                      </Animated>
                    </Animator>
                  )}

                  <Animator>
                    <Hr
                      className="!m-0 origin-left"
                      size={2}
                      animated={[['scaleX', 0, 1]]}
                      direction="both"
                    />
                  </Animator>

                  <Animator>
                    <Animated
                      as="div"
                      className={cx('cms-content', 'text-pretty')}
                      animated={['flicker']}
                      // The content is rendered by the CMS admin as markdown
                      // and converted to HTML at build time.
                      dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                  </Animator>
                </article>
              </Animator>
            </div>
          </Animator>
        </div>
      </Animator>
    </CmsAnimator>
  )
}

export { CmsPage }
