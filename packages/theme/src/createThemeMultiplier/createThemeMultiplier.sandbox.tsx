import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createThemeMultiplier } from '@arwes/theme'

const size = createThemeMultiplier((i) => i * 4)

const Sandbox = (): ReactElement => {
  return (
    <div style={{ display: 'flex', gap: '1rem', color: '#0ff' }}>
      <div style={{ width: size(1), height: size(1), background: 'currentcolor' }} />
      <div style={{ width: size(2), height: size(2), background: 'currentcolor' }} />
      <div style={{ width: size(3), height: size(3), background: 'currentcolor' }} />
      <div style={{ width: size(4), height: size(4), background: 'currentcolor' }} />
      <div style={{ width: size(5), height: size(5), background: 'currentcolor' }} />
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
