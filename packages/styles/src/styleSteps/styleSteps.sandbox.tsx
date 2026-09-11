import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { styleSteps } from '@arwes/styles'

const Sandbox = (): ReactElement => {
  return (
    <div style={{ display: 'grid', gap: '1rem', width: 300 }}>
      <div style={{ height: 50, background: styleSteps({ length: 7, color: 'green' }) }} />
      <div
        style={{
          height: 50,
          background: styleSteps({ length: 7, color: 'cyan', direction: '45deg' })
        }}
      />
      <div
        style={{
          height: 50,
          background: styleSteps({ length: 7, color: 'yellow', direction: '-45deg' })
        }}
      />
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
