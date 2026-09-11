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
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const tid = setInterval(() => setActive((v) => !v), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <div>
      <div style={{ color: 'cyan' }}>
        <div>{active ? 'Active' : 'Inactive'}</div>
        <div>{enabled ? 'Enabled' : 'Disabled'}</div>
        <button onClick={() => setEnabled((v) => !v)}>{enabled ? 'Disable' : 'Enable'}</button>
      </div>

      <Animator active={active} combine manager="stagger" refreshOn={[enabled]}>
        <Item />
        <Item />
        <Item condition={() => enabled} />
        <Item />
        <Item />
      </Animator>
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
