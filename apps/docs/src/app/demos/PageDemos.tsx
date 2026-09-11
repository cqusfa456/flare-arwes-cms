'use client'

import { Link } from '@/router'
import { Animated, Animator, BleepsOnAnimator, Text } from '@arwes/react'
import { DroneXmark as IconDevelopment, Page as IconDocs, Codepen as IconPlay } from 'iconoir-react'

import { type BleepNames, theme } from '@/config'
import { Button, FrameAlert } from '@/ui'

const PageDemos = (): JSX.Element => {
  return (
    <Animator combine>
      <BleepsOnAnimator<BleepNames> transitions={{ entering: 'error' }} continuous />

      <div className="flex-1 flex justify-center items-center p-4">
        <div className="relative flex px-6 py-12 md:p-12 xl:p-20">
          <Animator duration={{ enter: 0.6 }}>
            <FrameAlert />
          </Animator>

          <main className="relative flex flex-col items-center gap-6">
            <Animator duration={{ delay: 0.3 }}>
              <Animated
                className="text-error-4 text-[4rem]"
                animated={['flicker', ['y', theme.space(4), 0]]}
              >
                <IconDevelopment />
              </Animated>
            </Animator>

            <Animator>
              <Text as="h1" className="font-header text-size-2 leading-none text-error-5" fixed>
                Demos
              </Text>
            </Animator>

            <Animator duration={{ delay: 0.3 }}>
              <Animated
                as="p"
                className="font-body text-size-8 md:text-size-7 text-error-3"
                animated={['flicker', ['y', theme.space(-4), 0]]}
              >
                Demo projects are under construction.
              </Animated>
            </Animator>

            <Animator duration={{ delay: 0.3 }}>
              <Animated
                className="flex flex-row items-center gap-4"
                animated={['flicker', ['y', theme.space(-6), 0]]}
              >
                <Link href="/docs">
                  <Button tabIndex={-1}>
                    Docs <IconDocs />
                  </Button>
                </Link>
                <Link href="/play">
                  <Button tabIndex={-1}>
                    Play <IconPlay />
                  </Button>
                </Link>
              </Animated>
            </Animator>
          </main>
        </div>
      </div>
    </Animator>
  )
}

export { PageDemos }
