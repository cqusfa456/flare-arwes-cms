import { describe, test, expect } from 'vitest'

import { createThemeColor } from './createThemeColor'

describe('static list', () => {
  test('Should return item in hwb static list', () => {
    const themeColor = createThemeColor(['hwb(180 50% 50%)', 'hwb(180 60% 50%)'])
    expect(themeColor(0)).toBe('hwb(180 50% 50%)')
    expect(themeColor(1)).toBe('hwb(180 60% 50%)')
    expect(themeColor(3)).toBe('hwb(180 60% 50%)')
  })

  describe('alpha', () => {
    test('Should set hwb alpha value', () => {
      const themeColor = createThemeColor(['hwb(180 75% 50%)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('hwb(180 75% 50% / 0.5)')
    })

    test('Should update hwb alpha value', () => {
      const themeColor = createThemeColor(['hwb(180 75% 50% / 0.5)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('hwb(180 75% 50% / 0.25)')
    })

    test('Should update hwb alpha percentage', () => {
      const themeColor = createThemeColor(['hwb(180 75% 50% / 50%)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('hwb(180 75% 50% / 25%)')
    })
  })
})

describe('dynamic list', () => {
  test('Should return item in hwb dynamic list', () => {
    const themeColor = createThemeColor({
      color: 'hwb',
      list: [[180, 50, 50], [180, 60, 50, 0.5], 'hwb(180 70% 50%)']
    })
    expect(themeColor(0)).toBe('hwb(180 50% 50% / 1)')
    expect(themeColor(1)).toBe('hwb(180 60% 50% / 0.5)')
    expect(themeColor(2)).toBe('hwb(180 70% 50%)')
    expect(themeColor(3)).toBe('hwb(180 70% 50%)')
  })

  test('Should return item in hwb dynamic list within valid value ranges', () => {
    const themeColor = createThemeColor({
      color: 'hwb',
      list: [
        [-10, -10, -10, -1],
        [400, 120, 120, 1.5]
      ]
    })
    expect(themeColor(0)).toBe('hwb(0 0% 0% / 0)')
    expect(themeColor(1)).toBe('hwb(360 100% 100% / 1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in hwb dynamic list', () => {
      const themeColor = createThemeColor({
        color: 'hwb',
        list: [[180, 50, 50], [180, 60, 50, 0.5], 'hwb(180 70% 50%)']
      })
      expect(themeColor(0, { alpha: 0.5 })).toBe('hwb(180 50% 50% / 0.5)')
      expect(themeColor(1, { alpha: 0.5 })).toBe('hwb(180 60% 50% / 0.25)')
      expect(themeColor(2, { alpha: 0.5 })).toBe('hwb(180 70% 50% / 0.5)')
    })
  })
})

describe('function', () => {
  test('Should return item in hwb creator', () => {
    const themeColor = createThemeColor({
      color: 'hwb',
      create: (i) => [180, 75 + i, 50, 0.9]
    })
    expect(themeColor(0)).toBe('hwb(180 75% 50% / 0.9)')
    expect(themeColor(1)).toBe('hwb(180 76% 50% / 0.9)')
    expect(themeColor(2)).toBe('hwb(180 77% 50% / 0.9)')
  })

  test('Should return item in hwb creator with valid ranges', () => {
    const themeColor = createThemeColor({
      color: 'hwb',
      create: (i) => [200 * i, 50, 50 * i, 0.5 * i]
    })
    expect(themeColor(0)).toBe('hwb(0 50% 0% / 0)')
    expect(themeColor(1)).toBe('hwb(200 50% 50% / 0.5)')
    expect(themeColor(2)).toBe('hwb(360 50% 100% / 1)')
    expect(themeColor(3)).toBe('hwb(360 50% 100% / 1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in hwb creator', () => {
      const themeColor = createThemeColor({
        color: 'hwb',
        create: (i) => [i * 10, 50, 75, 0.5]
      })
      expect(themeColor(1, { alpha: 0.5 })).toBe('hwb(10 50% 75% / 0.25)')
      expect(themeColor(2, { alpha: 1 })).toBe('hwb(20 50% 75% / 0.5)')
    })
  })
})
