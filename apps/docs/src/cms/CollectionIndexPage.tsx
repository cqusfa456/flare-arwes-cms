'use client'

import { Animated, Animator, memo } from '@arwes/react'
import { animate, stagger } from 'motion'

import { Link } from '@/router'
import { CmsAnimator } from './CmsAnimator'

export type CollectionEntrySummary = {
  /** Public path of the entry, resolved from the collection's URL prefix. */
  href: string | null
  slug: string
  title: string
  publishedAt?: string
  summary?: string
}

type CollectionIndexPageProps = {
  /** Name of the collection being listed, e.g. Blog or Documentation. */
  heading?: string
  entries: CollectionEntrySummary[]
}

// A collection's index: the entries a site publishes, in the order the Astro route
// decided (newest first for a blog, the collection's own order for documentation).
// It is a React island like every other page so the list animates in with the rest
// of the site; as static Astro markup it appeared instantly with no enter animation
// at all.
const CollectionIndexPage = memo((props: CollectionIndexPageProps): JSX.Element => {
  const { heading = 'Index', entries } = props

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
                {heading}
              </Animated>
            </Animator>

            {entries.length === 0 && (
              <Animator>
                <Animated as="p" className="text-primary-low-2" animated={['flicker']}>
                  Nothing published yet.
                </Animated>
              </Animator>
            )}

            {entries.length > 0 && (
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
                  {entries.map((entry) => (
                    <li key={entry.slug} className="flex flex-col gap-1">
                      <Link
                        className="font-header text-size-5 text-secondary-low-2 hover:text-secondary-high-3"
                        href={entry.href ?? '#'}
                      >
                        {entry.title}
                      </Link>
                      {entry.publishedAt && (
                        <time
                          className="font-code text-size-10 text-primary-low-2"
                          dateTime={entry.publishedAt}
                        >
                          {entry.publishedAt}
                        </time>
                      )}
                      {entry.summary && (
                        <p className="text-primary-low-2 text-size-8">{entry.summary}</p>
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

export { CollectionIndexPage }
