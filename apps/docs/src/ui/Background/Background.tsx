import React, { type ReactElement } from 'react'
import { usePathname } from '@/router'
import { type AnimatedProp, memo, Animator, Animated, Dots, Puffs, cx, easing } from '@arwes/react'

interface BackgroundProps {
  className?: string
  animated?: AnimatedProp
}

const Background = memo((props: BackgroundProps): ReactElement => {
  const { className, animated } = props

  const pathname = usePathname()
  const isIndex = pathname === '/'

  return (
    <Animated
      role="presentation"
      className={cx('absolute inset-0 overflow-hidden select-none', className)}
      style={{
        background: 'radial-gradient(50% 50% at 50% 50%, #04252B 0%, #002424 0.01%, #001515 100%)'
      }}
      animated={animated}
    >
      <Animator duration={{ enter: 1 }}>
        <Animated
          as="picture"
          role="presentation"
          className="absolute inset-0 origin-top transition-[filter] ease-out duration-700"
          style={{
            filter: `brightness(${isIndex ? 0.4 : 0.3}) blur(${isIndex ? 0 : 10}px)`
          }}
          animated={{
            initialStyle: {
              opacity: 0.6,
              scale: 1.05
            },
            transitions: {
              entering: {
                opacity: [0.6, 1],
                scale: [1.05, 1],
                easing: easing.outExpo
              },
              exiting: {
                opacity: 0
              }
            }
          }}
        >
          <source
            media="(min-width:1280px)"
            srcSet="/assets/images/background-large.webp"
            type="image/webp"
          />
          <source
            media="(min-width:1280px)"
            srcSet="/assets/images/background-large.jpg"
            type="image/jpeg"
          />
          <source
            media="(min-width:768px)"
            srcSet="/assets/images/background-medium.webp"
            type="image/webp"
          />
          <source
            media="(min-width:768px)"
            srcSet="/assets/images/background-medium.jpg"
            type="image/jpeg"
          />
          <source
            media="(max-width:767px)"
            srcSet="/assets/images/background-small.webp"
            type="image/webp"
          />
          <img
            className="absolute inset-0 size-full object-cover object-center"
            src="/assets/images/background-small.jpg"
            alt=""
            // The backdrop is what the page opens on: it should not queue behind the
            // island's own JavaScript, which is where an image's default priority puts
            // it. (Lowercase, because React 18 passes unknown lowercase attributes
            // through and would warn about the camelCase spelling.)
            {...{ fetchpriority: 'high' }}
            decoding="async"
          />
        </Animated>
      </Animator>

      <Animator duration={{ enter: 1 }}>
        <Dots color="hsla(180, 50%, 70%, 0.15)" size={2} distance={40} originInverted />
      </Animator>

      <Animator duration={{ enter: 1, interval: 4 }}>
        <Puffs color="hsla(180, 50%, 70%, 0.25)" quantity={20} />
      </Animator>
    </Animated>
  )
})

export type { BackgroundProps }
export { Background }
