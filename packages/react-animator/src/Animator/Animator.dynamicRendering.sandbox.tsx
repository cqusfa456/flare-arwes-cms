// Initially, parent animator enters in sequence 10 group1 animators and 4 group2
// animators.
// Then, when the first 2 items in all the list are entered and the third item is
// entering, remove 2 group1 animators and add 6 group2 animators.
// In the space of the removed group1 animators, the first 2 added group2
// animators are placed, the remaining are added at the end of the timeline.

import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator, AnimatorGeneralProvider, useAnimator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Item = (props: { color: string }): ReactElement => {
  const animator = useAnimator()!
  return (
    <Animated
      style={{
        margin: 10,
        height: 20,
        width: 200,
        color: '#bbb',
        fontFamily: 'monospace',
        textAlign: 'center',
        background: props.color
      }}
      animated={[['x', 0, 100]]}
      hideOnExited={false}
    >
      {animator.node.id}
    </Animated>
  )
}

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(false)
  const [isToggled, setIsToggled] = useState(false)

  useEffect(() => {
    const tid1 = setTimeout(() => setActive(true), 1_000)
    const tid2 = setTimeout(() => setIsToggled(true), 1_450)

    return () => {
      clearTimeout(tid1)
      clearTimeout(tid2)
    }
  }, [])

  return (
    <AnimatorGeneralProvider duration={{ enter: 0.2, stagger: 0.1 }}>
      <Animator active={active} combine manager="sequence">
        <Item color="#333" />

        <div style={{ marginLeft: 20 }}>
          {Array(isToggled ? 8 : 10)
            .fill(0)
            .map((_, index) => (
              <Animator key={`group1-${index}`}>
                <Item color="#033" />
              </Animator>
            ))}

          {Array(isToggled ? 10 : 4)
            .fill(0)
            .map((_, index) => (
              <Animator key={`group2-${index}`}>
                <Item color="#330" />
              </Animator>
            ))}
        </div>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
