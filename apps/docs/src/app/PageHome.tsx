'use client'

import React from 'react'
import { Animator, Animated, BleepsOnAnimator, cx } from '@arwes/react'
import { Link } from '@/router'
import { Page, Codepen, CollageFrame, DashboardSpeed } from 'iconoir-react'

import { type BleepNames, settings, theme } from '@/config'
import { ArwesLogoType, ButtonSimple } from '@/ui'

const PageHome = (): JSX.Element => {
  return (
    // The three pieces come in together, a step apart. Played one after another
    // (sequenceReverse), the wordmark in the middle only started around 1.5s in,
    // which read as a slow page rather than a transition.
    <Animator combine manager="stagger">
      <BleepsOnAnimator<BleepNames> transitions={{ entering: 'intro' }} continuous />

      <Animated
        as="main"
        className={cx('flex flex-col justify-center items-center gap-4 m-auto p-6', 'md:gap-8')}
        animated={[['y', theme.space(6), 0, 0]]}
      >
        <Animator>
          <Animated as="h1" className="pb-2" title={settings.title}>
            <ArwesLogoType className="w-[200px] md:w-[240px] xl:w-[280px]" />
          </Animated>
        </Animator>

        <Animator>
          <Animated
            as="p"
            className={cx(
              'font-body leading-none text-size-7 select-none',
              'text-primary-main-3',
              'md:text-size-6',
              'xl:text-size-5'
            )}
            animated={['flicker']}
          >
            Futuristic Sci-Fi UI Web Framework
          </Animated>
        </Animator>

        <Animator>
          <Animated
            as="nav"
            className="flex flex-row justify-center items-center gap-2 md:gap-4"
            animated={['flicker']}
          >
            <Link href="/docs">
              <ButtonSimple
                tabIndex={-1}
                title="前往文档"
                animated={[['x', theme.spacen(-6), 0, 0]]}
              >
                <Page className="text-size-[1.5em] xhidden x2sm:block" />
                <span>Docs</span>
              </ButtonSimple>
            </Link>

            <Link href="/demos">
              <ButtonSimple
                tabIndex={-1}
                title="前往示例"
                animated={[['x', theme.spacen(-3), 0, 0]]}
              >
                <CollageFrame className="text-size-[1.5em] xhidden x2sm:block" />
                <span>Demos</span>
              </ButtonSimple>
            </Link>

            {settings.apps.play.url && (
              <a href={settings.apps.play.url}>
                <ButtonSimple
                  tabIndex={-1}
                  title="前往演练场"
                  animated={[['x', theme.spacen(3), 0, 0]]}
                >
                  <Codepen className="text-size-[1.5em] xhidden x2sm:block" />
                  <span>Play</span>
                </ButtonSimple>
              </a>
            )}

            {settings.apps.perf.url && (
              <a href={settings.apps.perf.url}>
                <ButtonSimple
                  tabIndex={-1}
                  title="前往性能测试"
                  animated={[['x', theme.spacen(6), 0, 0]]}
                >
                  <DashboardSpeed className="text-size-[1.5em] xhidden x2sm:block" />
                  <span>Perf</span>
                </ButtonSimple>
              </a>
            )}
          </Animated>
        </Animator>
      </Animated>
    </Animator>
  )
}

export { PageHome }
