import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { styleStrip } from '@arwes/styles'

const Sandbox = (): ReactElement => {
  return (
    <div style={{ display: 'grid', gap: '1rem', width: 300 }}>
      <div
        style={{
          height: 50,
          background: styleStrip({
            stops: [
              ['hsl(180, 50%, 50%)', '10px'],
              ['hsl(180, 50%, 30%)', '20px']
            ]
          })
        }}
      />
      <div
        style={{
          height: 50,
          background: styleStrip({
            direction: '45deg',
            stops: [
              ['hsl(180, 50%, 50%)', '2%'],
              ['hsl(180, 50%, 40%)', '4%'],
              ['hsl(180, 50%, 30%)', '6%']
            ]
          })
        }}
      />
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
