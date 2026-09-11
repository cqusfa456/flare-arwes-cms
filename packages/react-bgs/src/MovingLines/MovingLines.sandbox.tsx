// React integration of `createBackgroundMovingLines`.

import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { MovingLines } from '@arwes/react-bgs'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive(!active), active ? 3_000 : 1_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator active={active}>
      <MovingLines lineColor="hsla(180, 100%, 75%, 0.5)" />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
