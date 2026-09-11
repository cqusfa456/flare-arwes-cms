import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { styleSeparator } from '@arwes/styles'

const Sandbox = (): ReactElement => {
  return (
    <div style={{ display: 'grid', gap: '1rem', width: 300 }}>
      <div
        style={{
          width: '100%',
          height: 2,
          background: styleSeparator({
            colorStatic: 'hsl(180, 50%, 30%)',
            colorActive: 'hsl(180, 50%, 50%)'
          })
        }}
      />
      <div
        style={{
          width: '100%',
          height: 2,
          background: styleSeparator({
            colorStatic: 'hsl(180, 50%, 30%)',
            colorActive: 'hsl(180, 50%, 50%)',
            direction: 'both',
            width: '1rem',
            space: '0.5rem'
          })
        }}
      />
      <div
        style={{
          width: 2,
          height: 100,
          background: styleSeparator({
            colorStatic: 'hsl(180, 50%, 30%)',
            colorActive: 'hsl(180, 50%, 50%)',
            direction: 'left',
            isVertical: true
          })
        }}
      />
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
