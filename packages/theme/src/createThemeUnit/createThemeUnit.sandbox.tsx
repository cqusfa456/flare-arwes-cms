import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createThemeUnit } from '@arwes/theme'

const size = createThemeUnit((i) => `${i * 0.25}rem`)
// size(2) => '0.5rem'
// size([2, 'auto', 3]) => '0.5rem auto 0.75rem'

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
