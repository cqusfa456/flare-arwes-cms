import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((active) => !active), 2000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Animator active={active} initialState="entered">
      <Animated
        style={{ margin: 10, width: 40, height: 20, background: '#777' }}
        animated={{
          initialStyle: { x: 100, background: '#ff0' },
          transitions: {
            entering: { x: [0, 100], background: ['#0ff', '#ff0'] },
            exiting: { x: [100, 0], background: ['#ff0', '#0ff'] }
          }
        }}
        hideOnExited={false}
      />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
