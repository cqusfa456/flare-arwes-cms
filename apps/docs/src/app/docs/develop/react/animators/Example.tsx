import { useEffect, useState } from 'react'
import { Animated, Animator, AnimatorGeneralProvider, cx } from '@arwes/react'
import { theme } from '@/config'

type Props = {
  isDisabled?: boolean
  isPolished?: boolean
}

const Content = (props: Props): JSX.Element => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 2_000 : 1_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator
      root
      active={active}
      disabled={props.isDisabled}
      combine={props.isPolished}
      manager={props.isPolished ? 'stagger' : 'parallel'}
      duration={{ stagger: props.isPolished ? 0.1 : undefined }}
    >
      <Animated
        as="article"
        className={cx(
          'inline-flex flex-row items-center gap-4 p-4 not-prose',
          'border border-primary-main-7',
          'md:px-6 md:py-4'
        )}
        style={{
          background: `linear-gradient(0deg, ${theme.colors.primary.main(7, { alpha: 0.25 })}, ${theme.colors.primary.main(7, { alpha: 0.1 })})`
        }}
        animated={['fade']}
      >
        <Animator duration={{ enter: props.isPolished ? 0.8 : undefined }}>
          <Animated
            as="img"
            className="size-16"
            animated={['flicker', ['rotate', -45, 0]]}
            src="/assets/images/logoicon.svg"
          />
        </Animator>

        <div className="flex flex-col gap-2">
          <Animator>
            <Animated
              as="h1"
              className="font-header text-size-5 leading-none text-primary-main-3"
              animated={['fade', ['x', 20, 0]]}
            >
              <b>ARWES</b>
            </Animated>
          </Animator>

          <Animator>
            <Animated
              as="p"
              className="font-body text-size-7 leading-none text-primary-low-2"
              animated={['fade', ['x', 20, 0]]}
            >
              Futuristic Sci-Fi UI Web Framework.
            </Animated>
          </Animator>
        </div>
      </Animated>
    </Animator>
  )
}

const Example = (props: Props): JSX.Element => (
  <Animator unmountOnExited>
    <AnimatorGeneralProvider disabled={false} dismissed={false}>
      <Animated data-name="example">
        <Content {...props} />
      </Animated>
    </AnimatorGeneralProvider>
  </Animator>
)

export { Example }
