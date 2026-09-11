'use client'

import { Animator, cx } from '@arwes/react'
import { PlusCircle } from 'iconoir-react'

import communityApps from '../../../../../../../static/assets/community/apps/apps.json'
import { CommunityApp } from './CommunityApp'

const communityAppsList = communityApps.toSorted((a, b) =>
  !!a.outdated === !!b.outdated ? 0 : a.outdated && !b.outdated ? 1 : -1
)

const PageCommunityApps = (): JSX.Element => {
  return (
    <Animator combine manager="stagger" duration={{ stagger: 0.05 }}>
      <div className="flex flex-col gap-8 md:gap-12">
        <main
          className={cx(
            'grid grid-cols-1 gap-x-4 gap-y-8 mx-auto w-full max-w-screen-lg',
            'sm:grid-cols-2',
            'md:grid-cols-3 md:gap-y-12',
            'xl:grid-cols-4'
          )}
        >
          {communityAppsList.map((communityApp, index) => (
            <CommunityApp
              key={index}
              url={communityApp.url}
              imageURL={communityApp.image}
              videoURL={communityApp.video}
              repositoryURL={communityApp.repository}
              title={communityApp.name}
              isOutdated={communityApp.outdated}
              isExperimental={communityApp.experimental}
            >
              {communityApp.description}
            </CommunityApp>
          ))}
        </main>

        <div className="flex justify-end mx-auto w-full max-w-screen-lg">
          <a
            className="text-size-9 leading-none font-body text-primary-main-5 hover:text-primary-high-4"
            href="https://github.com/arwes/arwes/tree/next/static/assets/community/apps"
            target="_blank"
          >
            <p className="flex flex-row gap-1">
              <PlusCircle /> Add yours at GitHub
            </p>
          </a>
        </div>
      </div>
    </Animator>
  )
}

export { PageCommunityApps }
