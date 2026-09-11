'use client'

import { useEffect, useState } from 'react'
import { Animated, Animator, AnimatorGeneralProvider, Text } from '@arwes/react'

const Example = (): JSX.Element => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 5_000 : 1_500)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 1, exit: 1 }}>
      <Animator root active={active}>
        <Animated
          className="flex flex-col gap-2 px-8 py-2 bg-primary-main-7/10"
          hideOnExited={false}
        >
          <Text className="!m-0" fixed>
            <b>Sequence</b> rendering animation which consists in rendering a predefined number of
            characters per second with a ending blinking character.
          </Text>
          <Text className="!m-0" manager="decipher" fixed>
            <b>Decipher</b> rendering animation which consists in rendering a all characters at the
            same time from a ciphered set of characters to the actual set of characters.
          </Text>
        </Animated>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleText = (): JSX.Element => {
  return (
    <Animator unmountOnExited>
      <Animated data-name="example">
        <Example />
      </Animated>
    </Animator>
  )
}

export { ExampleText }
