import {
  createThemeBreakpoints,
  createThemeColor,
  createThemeMultiplier,
  createThemeUnit
} from '@arwes/react'

import { settings } from './settings'

export const theme = Object.freeze({
  // REMs unit.
  space: createThemeUnit((index) => `${index * 0.25}rem`),

  // Pixels as number unit.
  spacen: createThemeMultiplier((index) => index * 4),

  // Extends the Tailwind theme responsive breakpoints.
  breakpoints: createThemeBreakpoints([
    { key: '3sm', value: '375px' },
    { key: '2sm', value: '410px' },
    { key: 'sm', value: '640px' },
    { key: 'md', value: '768px' },
    { key: 'lg', value: '1024px' },
    { key: 'xl', value: '1280px' },
    { key: '2xl', value: '1536px' },
    { key: '3xl', value: '1980px' }
  ]),

  colors: {
    background: settings.background,
    primary: {
      low: createThemeColor([
        'hsl(180, 14.29%, 97.25%)',
        'hsl(180, 21.57%, 90.00%)',
        'hsl(180, 21.48%, 73.53%)',
        'hsl(180, 25.21%, 53.33%)',
        'hsl(180, 27.43%, 44.31%)',
        'hsl(180, 24.61%, 37.45%)',
        'hsl(180, 22.58%, 30.39%)',
        'hsl(180, 19.70%, 25.88%)',
        'hsl(180, 20.75%, 20.78%)',
        'hsl(180, 20.51%, 15.29%)',
        'hsl(180, 20.51%, 10%)',
        'hsl(180, 20.51%, 7%)',
        'hsl(180, 20%, 4%)'
      ]),
      main: createThemeColor([
        'hsl(180, 71.43%, 97.25%)',
        'hsl(180, 68.63%, 90.00%)',
        'hsl(180, 67.41%, 73.53%)',
        'hsl(180, 68.07%, 53.33%)',
        'hsl(180, 68.14%, 44.31%)',
        'hsl(180, 68.59%, 37.45%)',
        'hsl(180, 69.03%, 30.39%)',
        'hsl(180, 68.18%, 25.88%)',
        'hsl(180, 67.92%, 20.78%)',
        'hsl(180, 69.23%, 15.29%)',
        'hsl(180, 69.23%, 10%)',
        'hsl(180, 69.23%, 7%)',
        'hsl(180, 70%, 4%)'
      ]),
      high: createThemeColor([
        'hsl(180, 85.71%, 97.25%)',
        'hsl(180, 88.24%, 90.00%)',
        'hsl(180, 89.63%, 73.53%)',
        'hsl(180, 89.92%, 53.33%)',
        'hsl(180, 90.27%, 44.31%)',
        'hsl(180, 89.53%, 37.45%)',
        'hsl(180, 89.68%, 30.39%)',
        'hsl(180, 89.39%, 25.88%)',
        'hsl(180, 90.57%, 20.78%)',
        'hsl(180, 89.74%, 15.29%)',
        'hsl(180, 89.74%, 10.29%)',
        'hsl(180, 89.74%, 7.29%)',
        'hsl(180, 90%, 4%)'
      ])
    },
    secondary: {
      low: createThemeColor([
        'hsl(60, 20.00%, 96.08%)',
        'hsl(60, 21.13%, 86.08%)',
        'hsl(60, 24.44%, 64.71%)',
        'hsl(60, 26.23%, 47.84%)',
        'hsl(60, 24.30%, 41.96%)',
        'hsl(60, 22.22%, 35.29%)',
        'hsl(60, 20.55%, 28.63%)',
        'hsl(60, 20.33%, 24.12%)',
        'hsl(60, 19.19%, 19.41%)',
        'hsl(60, 19.44%, 14.12%)',
        'hsl(60, 20%, 10%)',
        'hsl(60, 20%, 7%)',
        'hsl(60, 20%, 4%)'
      ]),
      main: createThemeColor([
        'hsl(60, 70.00%, 96.08%)',
        'hsl(60, 69.01%, 86.08%)',
        'hsl(60, 67.78%, 64.71%)',
        'hsl(60, 68.85%, 47.84%)',
        'hsl(60, 68.22%, 41.96%)',
        'hsl(60, 68.89%, 35.29%)',
        'hsl(60, 68.49%, 28.63%)',
        'hsl(60, 69.11%, 24.12%)',
        'hsl(60, 67.68%, 19.41%)',
        'hsl(60, 69.44%, 14.12%)',
        'hsl(60, 70%, 10%)',
        'hsl(60, 70%, 7%)',
        'hsl(60, 70%, 4%)'
      ]),
      high: createThemeColor([
        'hsl(60, 90.00%, 96.08%)',
        'hsl(60, 88.73%, 86.08%)',
        'hsl(60, 90.00%, 64.71%)',
        'hsl(60, 90.16%, 47.84%)',
        'hsl(60, 89.72%, 41.96%)',
        'hsl(60, 90.00%, 35.29%)',
        'hsl(60, 90.41%, 28.63%)',
        'hsl(60, 90.24%, 24.12%)',
        'hsl(60, 89.90%, 19.41%)',
        'hsl(60, 88.89%, 14.12%)',
        'hsl(60, 90%, 10%)',
        'hsl(60, 90%, 7%)',
        'hsl(60, 90%, 4%)'
      ])
    },
    neutral: createThemeColor([
      'hsl(0, 0.00%, 98.04%)',
      'hsl(0, 0.00%, 93.33%)',
      'hsl(0, 0.00%, 83.53%)',
      'hsl(0, 0.00%, 74.12%)',
      'hsl(0, 0.00%, 64.71%)',
      'hsl(0, 0.00%, 54.51%)',
      'hsl(0, 0.00%, 44.31%)',
      'hsl(0, 0.00%, 37.25%)',
      'hsl(0, 0.00%, 29.80%)',
      'hsl(0, 0.00%, 21.96%)',
      'hsl(0, 0.00%, 12.16%)',
      'hsl(0, 0.00%, 8%)',
      'hsl(0, 0.00%, 5%)'
    ]),
    error: createThemeColor([
      'hsl(10, 75.00%, 98.43%)',
      'hsl(10, 71.42%, 94.50%)',
      'hsl(10, 69.01%, 86.07%)',
      'hsl(10, 69.64%, 78.03%)',
      'hsl(10, 69.23%, 69.41%)',
      'hsl(10, 69.37%, 59.01%)',
      'hsl(10, 49.99%, 47.84%)',
      'hsl(10, 49.75%, 40.58%)',
      'hsl(10, 50.30%, 32.35%)',
      'hsl(10, 49.59%, 24.11%)',
      'hsl(10, 50%, 18%)',
      'hsl(10, 50%, 14%)',
      'hsl(10, 50%, 9%)'
    ])
  },

  fontFamily: {
    header: [
      'var(--app-font-family-header)',
      '"Segoe UI Web (West European)"',
      '"Segoe UI"',
      '-apple-system',
      'BlinkMacSystemFont',
      'Roboto',
      '"Helvetica Neue"',
      'sans-serif'
    ],
    body: [
      'var(--app-font-family-body)',
      '"Segoe UI Web (West European)"',
      '"Segoe UI"',
      '-apple-system',
      'BlinkMacSystemFont',
      'Roboto',
      '"Helvetica Neue"',
      'sans-serif'
    ],
    cta: [
      'var(--app-font-family-cta)',
      '"Segoe UI Web (West European)"',
      '"Segoe UI"',
      '-apple-system',
      'BlinkMacSystemFont',
      'Roboto',
      '"Helvetica Neue"',
      'sans-serif'
    ],
    code: [
      'var(--app-font-family-code)',
      'JetBrains Mono',
      'Menlo',
      'Monaco',
      'Consolas',
      'Courier New',
      'monospace'
    ]
  }
})
