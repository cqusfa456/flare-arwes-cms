import { test, expect } from 'vitest'

import { styleStrip } from './styleStrip'

test('Should create strip', () => {
  const received = styleStrip({
    stops: [
      ['red', '10px'],
      ['blue', '20px']
    ]
  })
  const expected = 'repeating-linear-gradient(to right, red, red 10px, blue 10px, blue 20px)'
  expect(received).toBe(expected)
})

test('Should create strip with custom direction', () => {
  const received = styleStrip({
    direction: '45deg',
    stops: [
      ['red', '10px'],
      ['blue', '20px'],
      ['green', '30px']
    ]
  })
  const expected =
    'repeating-linear-gradient(45deg, red, red 10px, blue 10px, blue 20px, green 20px, green 30px)'
  expect(received).toBe(expected)
})
