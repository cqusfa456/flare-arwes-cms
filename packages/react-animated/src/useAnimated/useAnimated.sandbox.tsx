import React, { type ReactElement, useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { useAnimated } from '@arwes/react-animated'

const UI = (): ReactElement => {
  const elementRef = useRef<HTMLDivElement>(null)

  useAnimated(elementRef, {
    initialStyle: { background: '#fff' },
    transitions: {
      entering: { x: [0, 100], background: '#ff0' },
      exiting: { x: [100, 0], background: '#0ff' }
    }
  })

  return <div ref={elementRef} style={{ margin: 10, width: 50, height: 50, background: '#777' }} />
}

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((active) => !active), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Animator active={active}>
      <UI />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
