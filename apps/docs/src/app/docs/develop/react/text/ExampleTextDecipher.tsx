'use client'

import { useEffect, useState } from 'react'
import { Animated, Animator, AnimatorGeneralProvider, Text } from '@arwes/react'

const Example = (): JSX.Element => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 2_000 : 1_500)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 1, exit: 1 }}>
      <Animator root active={active}>
        <Animated
          className="flex flex-col gap-2 px-8 py-2 bg-primary-main-7/10"
          hideOnExited={false}
        >
          <Text className="!m-0 !font-code !text-size-4" manager="decipher" fixed>
            Pillars of Creation
          </Text>
        </Animated>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleTextDecipher = (): JSX.Element => {
  return (
    <Animator unmountOnExited>
      <Animated data-name="example">
        <Example />
      </Animated>
    </Animator>
  )
}

export { ExampleTextDecipher }
