import { describe, test, expect } from 'vitest'

import { createThemeBreakpoints } from './createThemeBreakpoints'

test('Should create breakpoints property with breakpoint keys', () => {
  const bps = createThemeBreakpoints([
    { key: 'a', value: 'x' },
    { key: 'b', value: 'y' },
    { key: 'c', value: 'z' }
  ])
  expect(bps.breakpoints).toStrictEqual(['a', 'b', 'c'])
})

test('Should create settings property with provided settings', () => {
  const bps = createThemeBreakpoints([
    { key: 'a', value: 'x' },
    { key: 'b', value: 'y' },
    { key: 'c', value: 'z' }
  ])
  expect(bps.settings).toStrictEqual([
    { key: 'a', value: 'x' },
    { key: 'b', value: 'y' },
    { key: 'c', value: 'z' }
  ])
})

describe('up', () => {
  test('Should return media query min-width', () => {
    const bps = createThemeBreakpoints()
    expect(bps.up('100px')).toBe('@media (min-width: 100px)')
  })

  test('Should return media query without the strip', () => {
    const bps = createThemeBreakpoints()
    expect(bps.up('100px', { strip: true })).toBe('(min-width: 100px)')
  })
})

describe('down', () => {
  test('Should return media query max-width', () => {
    const bps = createThemeBreakpoints()
    expect(bps.down('20rem')).toBe('@media (max-width: calc(20rem - 1px))')
  })

  test('Should return media query without the strip', () => {
    const bps = createThemeBreakpoints()
    expect(bps.down('20rem', { strip: true })).toBe('(max-width: calc(20rem - 1px))')
  })
})

describe('between', () => {
  test('Should return media of a range', () => {
    const bps = createThemeBreakpoints()
    expect(bps.between('100px', '200px')).toBe(
      '@media (min-width: 100px) and (max-width: calc(200px - 1px))'
    )
  })

  test('Should return media query without the strip', () => {
    const bps = createThemeBreakpoints()
    expect(bps.between('100px', '200px', { strip: true })).toBe(
      '(min-width: 100px) and (max-width: calc(200px - 1px))'
    )
  })
})
