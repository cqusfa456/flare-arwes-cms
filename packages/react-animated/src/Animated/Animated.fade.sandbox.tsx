import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((active) => !active), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Animator active={active} duration={{ enter: 1, exit: 1 }}>
      <Animated
        style={{ margin: 20, width: 50, height: 50, backgroundColor: '#0ff' }}
        animated={['fade']}
      />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
