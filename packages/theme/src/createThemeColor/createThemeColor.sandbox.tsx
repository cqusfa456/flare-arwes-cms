import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createThemeColor } from '@arwes/theme'

const colors = [
  createThemeColor([
    'hsl(180, 71.43%, 97.25%)',
    'hsl(180, 68.63%, 90.00%)',
    'hsl(180, 67.41%, 73.53%)',
    'hsl(180, 68.07%, 53.33%)',
    'hsl(180, 68.14%, 44.31%)',
    'hsl(180, 68.59%, 37.45%)',
    'hsl(180, 69.03%, 30.39%)',
    'hsl(180, 68.18%, 25.88%)',
    'hsl(180, 67.92%, 20.78%)',
    'hsl(180, 69.23%, 15.29%)'
  ]),
  createThemeColor((i) => [180, 60 + i, 92.5 - i * 9.44]),
  createThemeColor({
    color: 'lch',
    create: (i) => [95 - i * 8, i < 5 ? 8 + i * 9 : 60 - i * 3, 200]
  })
]

const Sandbox = (): ReactElement => {
  return (
    <div>
      {Array(colors.length)
        .fill(0)
        .map((_, colorIndex) => (
          <div
            key={colorIndex}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gridTemplateRows: '1fr',
              width: 300,
              height: 100
            }}
          >
            {Array(10)
              .fill(null)
              .map((_, variantIndex) => (
                <div key={variantIndex} style={{ background: colors[colorIndex](variantIndex) }} />
              ))}
          </div>
        ))}
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
