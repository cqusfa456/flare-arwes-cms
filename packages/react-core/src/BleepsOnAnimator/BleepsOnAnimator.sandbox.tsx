import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'
import type { BleepsManagerProps } from '@arwes/bleeps'
import { BleepsProvider } from '@arwes/react-bleeps'
import { BleepsOnAnimator } from '@arwes/react-core'

type BleepsNames = 'click' | 'type'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((active) => !active), 2_000)
    return () => clearInterval(tid)
  }, [])

  const [settings] = useState<BleepsManagerProps<BleepsNames>>({
    master: {
      volume: 0.75
    },
    bleeps: {
      click: {
        sources: [{ src: '/assets/sounds/click.mp3', type: 'audio/mpeg' }]
      },
      type: {
        sources: [{ src: '/assets/sounds/type.mp3', type: 'audio/mpeg' }],
        loop: true
      }
    }
  })

  return (
    <BleepsProvider {...settings}>
      <Animator active={active}>
        <Animated
          style={{ margin: 10, width: 40, height: 40 }}
          animated={[
            ['x', 0, 100],
            ['background', '#0ff', '#ff0']
          ]}
          hideOnExited={false}
        />
        <BleepsOnAnimator<BleepsNames>
          transitions={{
            entering: 'click',
            exiting: 'type'
          }}
        />
      </Animator>
    </BleepsProvider>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
