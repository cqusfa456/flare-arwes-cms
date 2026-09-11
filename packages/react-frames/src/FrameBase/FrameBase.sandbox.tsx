import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { type FrameSettings } from '@arwes/frames'
import { FrameBase } from '@arwes/react-frames'

const frameSettings: FrameSettings = {
  elements: [
    // Background shape.
    {
      type: 'path',
      name: 'bg',
      style: { strokeWidth: 0, fill: 'hsl(180, 75%, 10%)' },
      path: [
        // Top.
        ['M', 5, 35],
        ['v', -20],
        ['l', 10, -10],
        ['H', '100% - 15'],
        ['l', 10, 10],
        ['v', 20],
        // Bottom.
        ['V', '100% - 15'],
        ['l', -10, 10],
        ['H', 15],
        ['l', -10, -10]
      ]
    },
    // Top line.
    {
      type: 'path',
      name: 'line',
      style: { stroke: 'hsl(180, 75%, 50%)', strokeWidth: '2', fill: 'none' },
      path: [
        ['M', 1, 31],
        ['v', -20],
        ['l', 10, -10],
        ['H', '100% - 11'],
        ['l', 10, 10],
        ['v', 20]
      ]
    },
    // Bottom line.
    {
      type: 'path',
      name: 'line',
      style: { stroke: 'hsl(180, 75%, 50%)', strokeWidth: '2', fill: 'none' },
      path: [
        ['M', 1, '100% - 31'],
        ['v', 20],
        ['l', 10, 10],
        ['H', '100% - 11'],
        ['l', 10, -10],
        ['v', -20]
      ]
    }
  ]
}

const Sandbox = (): ReactElement => {
  return (
    <div style={{ position: 'relative', width: 300, height: 200 }}>
      <FrameBase settings={frameSettings} />
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
