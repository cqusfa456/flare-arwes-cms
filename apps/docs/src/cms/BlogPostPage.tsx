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
const BlogPostPage = (props: BlogPostPageProps): JSX.Element => {
  const { title, contentHtml, publishedAt } = props

  return (
    <Animator combine manager="sequence">
      <div className="flex-1 overflow-y-auto flex p-4 min-w-0 min-h-0 md:p-8">
        <div className="relative flex flex-col gap-6 m-auto w-full min-w-0 min-h-0 max-w-screen-lg">
          <Animator combine manager="stagger">
            <h1 className="text-3xl font-bold">{title}</h1>
            {publishedAt && <p className="opacity-60 text-sm">{publishedAt}</p>}
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
