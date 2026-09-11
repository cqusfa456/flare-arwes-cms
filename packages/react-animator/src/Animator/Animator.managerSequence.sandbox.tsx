import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Item = (): ReactElement => {
  return (
    <Animator duration={{ enter: 0.15 }}>
      <Animated
        style={{ margin: 10, width: 40, height: 20, background: '#777' }}
        animated={[
          ['x', 0, 100],
          ['background', '#0ff', '#ff0']
        ]}
        hideOnExited={false}
      />
    </Animator>
  )
}

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((v) => !v), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Animator active={active} combine manager="sequence">
      {Array(10)
        .fill(0)
        .map((_, i) => (
          <Item key={i} />
        ))}
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
