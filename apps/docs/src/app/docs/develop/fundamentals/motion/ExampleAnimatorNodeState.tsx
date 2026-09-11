'use client'

import { useEffect, useState } from 'react'
import { Animated, Animator, cx, useAnimator } from '@arwes/react'

import { theme } from '@/config'

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
        className={cx(
          'flex justify-center items-center border w-[6rem] h-[3rem] min-w-0 text-center',
          'border-primary-main-8 text-neutral-1 bg-primary-main-10'
        )}
        animated={[
          ['x', 0, 100],
          ['borderColor', theme.colors.primary.main(8), theme.colors.secondary.main(6)],
          ['background', theme.colors.primary.main(10), theme.colors.secondary.main(8)]
        ]}
        hideOnExited={false}
      >
        <ExampleText />
      </Animated>
    </Animator>
  )
}

const ExampleAnimatorNodeState = (): JSX.Element => (
  <Animator unmountOnExited>
    <Animated data-name="example">
      <Example />
    </Animated>
  </Animator>
)

export { ExampleAnimatorNodeState }
