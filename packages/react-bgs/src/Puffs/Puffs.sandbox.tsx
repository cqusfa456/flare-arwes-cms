// React integration of `createBackgroundPuffs`.

import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Puffs } from '@arwes/react-bgs'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive(!active), active ? 3_000 : 1_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator
      active={active}
      duration={{
        // The duration of an individual animation sequence.
        interval: 2
      }}
    >
      <Puffs color="hsla(180, 100%, 75%, 0.5)" quantity={20} />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
