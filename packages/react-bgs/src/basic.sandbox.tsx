import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'
import { Dots } from '@arwes/react-bgs'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 3_000 : 1_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator active={active}>
      {/* The parent element of the background component should be positioned. */}
      <div style={{ position: 'relative', display: 'inline-block', padding: '1rem 2rem' }}>
        {/* The background component will take all space inside the nearest positioned parent. */}
        <Dots color="hsla(180, 100%, 75%, 0.4)" size={2} distance={10} />

        {/* The background component is positioned so the other elements which need
            to be on top should also be positioned. You can change this behaviour
            by using z-index property of any of them. */}
        <Animated
          style={{ position: 'relative', fontSize: '2rem', color: 'cyan' }}
          animated={['fade']}
        >
          Futuristic Sci-Fi UI Web Framework
        </Animated>
      </div>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
