import React, { type ReactElement, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useAnimatedX } from '@arwes/react-animated'

type Positions = 'a' | 'b' | 'c'

const Sandbox = (): ReactElement => {
  const elementRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Positions>('a')

  useAnimatedX<Positions>(position, elementRef, {
    initialStyle: { background: '#fff' },
    transitions: {
      a: { x: 0, background: '#0ff' },
      b: { x: 100, background: '#ff0' },
      c: { x: 200, background: '#f0f' }
    }
  })

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
      1_000
    )
    return () => clearInterval(tid)
  }, [])

  return <div ref={elementRef} style={{ margin: 10, width: 50, height: 50, background: '#777' }} />
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
