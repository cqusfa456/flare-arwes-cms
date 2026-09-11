'use client'

import { useEffect, useState } from 'react'
import { Animated, Animator, AnimatorGeneralProvider, Text } from '@arwes/react'

const Example = (): JSX.Element => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 5_000 : 1_500)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 1, exit: 1 }}>
      <Animator root active={active} combine manager="sequence">
        <Animated className="px-8 py-2 bg-primary-main-7/10" hideOnExited={false}>
          <Animator>
            <Text>
              This text is animated with a special effect where the text is rendered character by
              character and its transition duration is calculated based on its length.
            </Text>
          </Animator>
          <Animator>
            <Text>Shorter texts transition faster.</Text>
          </Animator>
          <Animator>
            <Text>Longer texts transition slower.</Text>
          </Animator>
        </Animated>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleText = (): JSX.Element => (
  <Animator unmountOnExited>
    <Animated data-name="example">
      <Example />
    </Animated>
  </Animator>
)

export { ExampleText }
