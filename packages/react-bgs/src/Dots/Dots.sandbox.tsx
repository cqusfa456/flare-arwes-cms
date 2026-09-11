// React integration of `createBackgroundDots`.

import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Dots } from '@arwes/react-bgs'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const iid = setInterval(() => setActive((active) => !active), 3_000)
    return () => clearInterval(iid)
  }, [])

  return (
    <Animator active={active} duration={{ enter: 2, exit: 2 }}>
      <Dots color="hsla(180, 100%, 75%, 0.4)" />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
