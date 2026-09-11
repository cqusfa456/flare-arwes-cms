// React integration of `createFrameKranoxSettings`.

import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { FrameKranox } from '@arwes/react-frames'

const Sandbox = (): ReactElement => {
  return (
    <Animator>
      <div style={{ position: 'relative', width: 300, height: 200 }}>
        <FrameKranox
          style={{
            // @ts-expect-error css variables
            '--arwes-frames-bg-color': 'hsl(180, 75%, 10%)',
            '--arwes-frames-line-color': 'hsl(180, 75%, 30%)',
            '--arwes-frames-deco-color': 'hsl(180, 75%, 50%)'
          }}
        />
      </div>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
