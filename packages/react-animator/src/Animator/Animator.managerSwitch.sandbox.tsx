import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { type AnimatorProps, Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Item = (props: AnimatorProps): ReactElement => {
  return (
    <Animator {...props}>
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
  const [firstEnabled, setFirstEnabled] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((v) => !v), 3_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <div>
      <div style={{ color: 'cyan' }}>
        <div>{active ? 'Active' : 'Inactive'}</div>
        <div>{firstEnabled ? 'First' : 'Second'}</div>
        <button onClick={() => setFirstEnabled((v) => !v)}>
          {firstEnabled ? 'Enable Second' : 'Enable First'}
        </button>
      </div>

      <Animator
        active={active}
        combine
        manager="switch"
        // Dependency list to refresh the animator.
        refreshOn={[firstEnabled]}
      >
        <Item condition={() => firstEnabled} />
        <Item condition={() => !firstEnabled} />
      </Animator>
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
