import { describe, test, expect } from 'vitest'

import { createThemeColor } from './createThemeColor'

describe('static list', () => {
  test('Should return item in lch static list', () => {
    const themeColor = createThemeColor(['lch(50% 50% 180)', 'lch(60% 50% 180)'])
    expect(themeColor(0)).toBe('lch(50% 50% 180)')
    expect(themeColor(1)).toBe('lch(60% 50% 180)')
    expect(themeColor(3)).toBe('lch(60% 50% 180)')
  })

  describe('alpha', () => {
    test('Should set lch alpha value', () => {
      const themeColor = createThemeColor(['lch(75% 50% 180)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('lch(75% 50% 180 / 0.5)')
    })

    test('Should update lch alpha value', () => {
      const themeColor = createThemeColor(['lch(75% 50% 180 / 0.5)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('lch(75% 50% 180 / 0.25)')
    })

    test('Should update lch alpha percentage', () => {
      const themeColor = createThemeColor(['lch(75% 50% 180 / 50%)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('lch(75% 50% 180 / 25%)')
    })
  })
})

describe('dynamic list', () => {
  test('Should return item in lch dynamic list', () => {
    const themeColor = createThemeColor({
      color: 'lch',
      list: [[50, 50, 180], [60, 50, 180, 0.5], 'lch(70% 50% 180)']
    })
    expect(themeColor(0)).toBe('lch(50 50 180 / 1)')
    expect(themeColor(1)).toBe('lch(60 50 180 / 0.5)')
    expect(themeColor(2)).toBe('lch(70% 50% 180)')
    expect(themeColor(3)).toBe('lch(70% 50% 180)')
  })

  test('Should return item in lch dynamic list within valid value ranges', () => {
    const themeColor = createThemeColor({
      color: 'lch',
      list: [
        [-10, -10, -10, -1],
        [120, 300, 400, 1.5]
      ]
    })
    expect(themeColor(0)).toBe('lch(0 0 0 / 0)')
    expect(themeColor(1)).toBe('lch(100 230 360 / 1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in lch dynamic list', () => {
      const themeColor = createThemeColor({
        color: 'lch',
        list: [[50, 50, 180], [60, 50, 180, 0.5], 'lch(70% 50% 180)']
      })
      expect(themeColor(0, { alpha: 0.5 })).toBe('lch(50 50 180 / 0.5)')
      expect(themeColor(1, { alpha: 0.5 })).toBe('lch(60 50 180 / 0.25)')
      expect(themeColor(2, { alpha: 0.5 })).toBe('lch(70% 50% 180 / 0.5)')
    })
  })
})

describe('function', () => {
  test('Should return item in lch creator', () => {
    const themeColor = createThemeColor({
      color: 'lch',
      create: (i) => [75 + i, 50, 180, 0.9]
    })
    expect(themeColor(0)).toBe('lch(75 50 180 / 0.9)')
    expect(themeColor(1)).toBe('lch(76 50 180 / 0.9)')
    expect(themeColor(2)).toBe('lch(77 50 180 / 0.9)')
  })

  test('Should return item in lch creator with valid ranges', () => {
    const themeColor = createThemeColor({
      color: 'lch',
      create: (i) => [50, 200 * i, 200 * i, 0.5 * i]
    })
    expect(themeColor(0)).toBe('lch(50 0 0 / 0)')
    expect(themeColor(1)).toBe('lch(50 200 200 / 0.5)')
    expect(themeColor(2)).toBe('lch(50 230 360 / 1)')
    expect(themeColor(3)).toBe('lch(50 230 360 / 1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in lch creator', () => {
      const themeColor = createThemeColor({
        color: 'lch',
        create: (i) => [50, 75, i * 10, 0.5]
      })
      expect(themeColor(1, { alpha: 0.5 })).toBe('lch(50 75 10 / 0.25)')
      expect(themeColor(2, { alpha: 1 })).toBe('lch(50 75 20 / 0.5)')
    })
  })
})
