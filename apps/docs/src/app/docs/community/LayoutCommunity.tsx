'use client'

import { type ReactNode } from 'react'
import { Animator, FrameHeader, cx } from '@arwes/react'

import { CommunityLoadingScreen } from './CommunityLoadingScreen'
import { CommunityHeader } from './CommunityHeader'

const LayoutCommunity = (props: { children: ReactNode }): JSX.Element => {
  return (
    <Animator combine manager="sequence">
      <div className="flex-1 flex justify-center min-w-0 min-h-0">
        <div
          className={cx(
            'relative flex flex-col gap-2 p-2 w-full min-w-0 min-h-0 max-w-screen-3xl',
            'md:gap-4 md:p-4'
          )}
        >
          <CommunityLoadingScreen />

          <Animator combine>
            <CommunityHeader />

            <Animator combine>
              <div className="flex-1 flex flex-row gap-2 min-w-0 min-h-0 md:gap-4">
                <Animator duration={{ enter: 0.8 }}>
                  <aside className="relative flex w-2 h-full">
                    <FrameHeader direction="vertical" align="top" />
                  </aside>
                </Animator>

                <div className="flex-1 overflow-y-auto flex flex-col pb-8 min-w-0 min-h-0">
                  {props.children}
                </div>
              </div>
            </Animator>
          </Animator>
        </div>
      </div>
    </Animator>
  )
}

export { LayoutCommunity }
