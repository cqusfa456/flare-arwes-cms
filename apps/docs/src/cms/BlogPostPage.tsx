'use client'

import { Animator } from '@arwes/react'

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

  return (
    <Animator combine manager="sequence">
      <div className="flex-1 overflow-y-auto flex p-4 min-w-0 min-h-0 md:p-8">
        <div className="relative flex flex-col gap-6 m-auto w-full min-w-0 min-h-0 max-w-screen-lg">
          <Animator combine manager="stagger">
            <h1 className="font-header text-size-2 text-primary-main-3">{title}</h1>
            {publishedAt && (
              <p className="font-code text-size-10 text-primary-low-2">{publishedAt}</p>
            )}
          </Animator>
          <Animator>
            <article
              className="prose prose-sm lg:prose-base max-w-none"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </Animator>
        </div>
      </div>
    </Animator>
  )
}

export { BlogPostPage }
