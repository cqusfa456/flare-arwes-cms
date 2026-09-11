import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AnimatedX } from '@arwes/react-animated'

type Positions = 'a' | 'b' | 'c'

const Sandbox = (): ReactElement => {
  const [position, setPosition] = useState<Positions>('a')

  useEffect(() => {
    const tid = setInterval(
      () =>
        setPosition((p) => {
          switch (p) {
            case 'a':
              return 'b'
            case 'b':
              return 'c'
            default:
              return 'a'
          }
        }),
      1000
    )
    return () => clearInterval(tid)
  }, [])

  return (
    <AnimatedX<Positions>
      style={{ margin: 10, width: 50, height: 50, background: '#777' }}
      state={position}
      animated={{
        initialStyle: { background: '#fff' },
        transitions: {
          a: { x: 0, background: '#0ff' },
          b: { x: 100, background: '#ff0' },
          c: { x: 200, background: '#f0f' }
        }
      }}
    />
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
