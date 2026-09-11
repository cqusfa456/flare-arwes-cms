import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { styleFrameClipOctagon } from '@arwes/frames'
import { Illuminator } from '@arwes/react-effects'

const Sandbox = (): ReactElement => {
  return (
    <div>
      <p style={{ color: '#fff' }}>Move mouse over the page.</p>
      <div style={{ position: 'relative', width: 300, height: 300 }}>
        <Illuminator
          style={{ clipPath: styleFrameClipOctagon({ squareSize: 50 }) }}
          color="hsl(180 50% 50% / 20%)"
          size={300}
        />
      </div>
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
