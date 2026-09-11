'use client'

import { useEffect, useState } from 'react'
import { Animated, Animator, draw, useAnimator } from '@arwes/react'

const ExampleText = (): JSX.Element => {
  const animator = useAnimator()!
  const [state, setState] = useState('')

  useEffect(() => animator.node.subscribe((node) => setState(node.state)), [])

  return <>{state}</>
}

const Example = (): JSX.Element => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), 2_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator
      root
      disabled={false}
      dismissed={false}
      active={active}
      duration={{ enter: 1, exit: 1 }}
    >
      <Animated
        className="relative inline-flex justify-center items-center w-[6rem] h-[3rem] text-neutral-1"
        animated={[['x', 0, 100]]}
        hideOnExited={false}
      >
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 200 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <Animated<SVGPathElement>
            as="path"
            className="stroke-secondary-main-3"
            d="M0,1 L200,1"
            stroke="2"
            animated={draw(0.5)}
          />
          <Animated<SVGPathElement>
            as="path"
            className="stroke-secondary-main-3"
            d="M200,99 L0,99"
            stroke="2"
            animated={draw(0.5)}
          />
        </svg>
        <Animated
          className="absolute inset-0 bg-secondary-main-3/20"
          animated={{
            transitions: {
              entering: { opacity: [0.1, 1, 0.5, 1], delay: 0.5, duration: 0.5 },
              exiting: { opacity: [1, 0.1, 0.5, 0.1], delay: 0.5, duration: 0.5 }
            }
          }}
          hideOnExited={false}
        />
        <Animated
          className="relative"
          animated={[
            ['scale', 1, 1.25],
            ['opacity', 0.5, 1]
          ]}
          hideOnExited={false}
        >
          <ExampleText />
        </Animated>
      </Animated>
    </Animator>
  )
}

const ExampleAnimated = (): JSX.Element => (
  <Animator unmountOnExited>
    <Animated data-name="example">
      <Example />
    </Animated>
  </Animator>
)

export { ExampleAnimated }
