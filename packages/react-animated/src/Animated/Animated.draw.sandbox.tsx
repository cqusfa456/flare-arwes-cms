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
      <svg
        width="200"
        height="100"
        viewBox="0 0 200 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Animated<SVGPathElement>
          as="path"
          stroke="#0ff"
          strokeWidth="2"
          fill="none"
          d="M0,1 H100 V50 H200"
          animated={['draw']}
        />
      </svg>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
