import { type ReactNode } from 'react'
import { Animated, Animator, AnimatorGeneralProvider, Text, cx, memo } from '@arwes/react'
import { FastArrowRight, NavArrowRight } from 'iconoir-react'

import communityApps from '../../../../../../static/assets/community/apps/apps.json'

const LineMajor = (props: { children: ReactNode; offset?: number }): JSX.Element => (
  <Animator duration={{ offset: props.offset }} unmountOnExited>
    <Text blink={false} contentClassName="flex flex-row items-start gap-1 text-primary-main-5">
      <FastArrowRight className="inline-block flex-shrink-0 mt-1" /> {props.children}
    </Text>
  </Animator>
)

const LineMinor = (props: { children: ReactNode; offset?: number }): JSX.Element => (
  <Animator duration={{ offset: props.offset }} unmountOnExited>
    <Text blink={false} contentClassName="flex flex-row items-start gap-1 text-primary-main-6">
      <NavArrowRight className="inline-block flex-shrink-0 mt-1" /> {props.children}
    </Text>
  </Animator>
)

const CommunityLoadingScreen = memo((): JSX.Element => {
  return (
    <AnimatorGeneralProvider duration={{ enter: 0.1, stagger: 0.07 }}>
      <Animator combine manager="stagger" unmountOnEntered unmountOnDisabled>
        <div className="absolute inset-0 flex justify-center items-center p-2 md:p-4">
          <Animated
            className={cx(
              'flex flex-col w-full max-w-screen-md font-code text-size-10 opacity-0',
              'md:text-size-9',
              'xl:text-size-8'
            )}
            animated={[
              {
                transitions: {
                  entering: ({ element, duration, animate }) => {
                    element.style.opacity = '1'
                    return animate(
                      element,
                      { opacity: [1, 0, 0.5, 0] },
                      { delay: duration - 0.2, duration: 0.2 }
                    )
                  }
                }
              },
              ['y', '2rem', 0, 0, 'outExpo']
            ]}
          >
            <LineMajor>Loading community projects...</LineMajor>
            <LineMajor offset={0.1}> Initializing internet scanner...</LineMajor>
            <LineMinor>Internet scanner has been successfully initialized.</LineMinor>
            <LineMajor>Fetching community application projects metadata...</LineMajor>
            <LineMinor offset={0.2}>
              Found {communityApps.length} application projects registered with complete
              information.
            </LineMinor>
            <LineMajor>Fetching community similar projects metadata...</LineMajor>
            <LineMinor offset={0.2}>
              Found 1 similar projects registered with complete information.
            </LineMinor>
            <LineMajor offset={0.1}> Starting user interface rendering system...</LineMajor>
            <LineMinor>User interface rendering system has been successfully started.</LineMinor>
            <LineMinor>Rendering available information to the user.</LineMinor>

            {/* Last delay duration. */}
            <Animator duration={{ enter: 0.6 }} />
          </Animated>
        </div>
      </Animator>
    </AnimatorGeneralProvider>
  )
})

export { CommunityLoadingScreen }
