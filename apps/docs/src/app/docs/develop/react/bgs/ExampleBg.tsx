'use client'

import { Animated, Animator, AnimatorGeneralProvider, Puffs } from '@arwes/react'
import { theme } from '@/config'

const Example = (): JSX.Element => {
  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 1, exit: 1 }}>
      <Animator root active>
        <Animated className="relative flex w-full h-80" hideOnExited={false}>
          <Puffs
            color={theme.colors.secondary.main(3, { alpha: 0.5 })}
            quantity={100}
            padding={0}
            xOffset={[10, 50]}
            yOffset={[-20, -80]}
            radiusOffset={[4, 20]}
          />
          <b className="m-auto text-size-1 text-secondary-main-3">ARWES</b>
        </Animated>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleBg = (): JSX.Element => {
  return (
    <Animator unmountOnExited>
      <Animated data-name="example">
        <Example />
      </Animated>
    </Animator>
  )
}

export { ExampleBg }
