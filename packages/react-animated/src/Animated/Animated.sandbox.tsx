// The `<Animated/>` component simplifies the definition of animations
// based on the closest parent `<Animator/>` state.
// It uses [Motion](https://motion.dev) for the animation functionalities.

import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Item = (): ReactElement => {
  return (
    <Animator>
      <Animated
        as="div" // Default element.
        style={{ margin: 10, width: 40, height: 20, background: '#777' }}
        // Animations definitions.
        animated={{
          // If the animator is enabled, these will be the initial styles
          // rendered in the HTML/SVG element.
          initialStyle: { background: '#fff' },
          // THe animation for every animator transition.
          transitions: {
            // Every animation also accepts the settings:
            // - duration: number
            // - repeat: number
            // - delay: number | motion/stagger(value: number)
            // - easing: [name] | (x: number) => number
            // - direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
            entering: { x: 100, background: '#ff0' },
            exiting: { x: 0, background: '#0ff' }
          }
        }}
      />
    </Animator>
  )
}

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((active) => !active), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Animator active={active} manager="stagger" combine>
      {Array(10)
        .fill(null)
        .map((_, i) => (
          <Item key={i} />
        ))}
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
