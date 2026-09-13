'use client'

import { Animated, Animator, memo } from '@arwes/react'
import { animate, stagger } from 'motion'

import { Link } from '@/router'
import { CmsAnimator } from './CmsAnimator'

export type BlogPostSummary = {
  slug: string
  title: string
  publishedAt?: string
  summary?: string
}

type BlogIndexPageProps = {
  posts: BlogPostSummary[]
}

// Blog index: the CMS *pages*, newest first (the order is decided at build time
// by the Astro route). It is a React island like every other page so the list
// animates in with the rest of the site; as static Astro markup it appeared
// instantly with no enter animation at all.
const BlogIndexPage = memo((props: BlogIndexPageProps): JSX.Element => {
  const { posts } = props

  return (
    <CmsAnimator>
      <Animator combine manager="sequence">
        <div className="flex-1 overflow-y-auto flex p-4 min-w-0 min-h-0 md:p-8">
          <div className="relative flex flex-col gap-6 m-auto w-full min-w-0 max-w-screen-lg">
            <Animator>
              <Animated
                as="h1"
                className="font-header text-size-2 text-primary-main-3"
                animated={['flicker']}
              >
                Blog
              </Animated>
            </Animator>

            {posts.length === 0 && (
              <Animator>
                <Animated as="p" className="text-primary-low-2" animated={['flicker']}>
                  No posts yet.
                </Animated>
              </Animator>
            )}

            {posts.length > 0 && (
              <Animator>
                <Animated
                  as="ul"
                  className="flex flex-col gap-5"
                  animated={{
                    transitions: {
                      entering: ({ $, duration }) =>
                        animate(
                          $(':scope > li'),
                          { opacity: [0, 1, 0.5, 1] },
                          { duration, delay: stagger(0.05) }
                        ),
                      exiting: { opacity: [1, 0, 0.5, 0] }
                    }
                  }}
                >
                  {posts.map((post) => (
                    <li key={post.slug} className="flex flex-col gap-1">
                      <Link
                        className="font-header text-size-5 text-secondary-low-2 hover:text-secondary-high-3"
                        href={`/blog/${post.slug}/`}
                      >
                        {post.title}
                      </Link>
                      {post.publishedAt && (
                        <time
                          className="font-code text-size-10 text-primary-low-2"
                          dateTime={post.publishedAt}
                        >
                          {post.publishedAt}
                        </time>
                      )}
                      {post.summary && (
                        <p className="text-primary-low-2 text-size-8">{post.summary}</p>
                      )}
                    </li>
                  ))}
                </Animated>
              </Animator>
            )}
          </div>
        </div>
      </Animator>
    </CmsAnimator>
  )
})

export { BlogIndexPage }
