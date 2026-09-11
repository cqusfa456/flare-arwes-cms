import { describe, test, expect } from 'vitest'

import { createThemeColor } from './createThemeColor'

describe('list static', () => {
  test('Should return item in hsl static list', () => {
    const themeColor = createThemeColor(['hsl(100,50%,60%)', 'hsl(100,50%,50%)'])
    expect(themeColor(0)).toBe('hsl(100,50%,60%)')
    expect(themeColor(1)).toBe('hsl(100,50%,50%)')
    expect(themeColor(2)).toBe('hsl(100,50%,50%)')
  })

  describe('alpha', () => {
    describe('separated by commas', () => {
      test('Should set hsl alpha value', () => {
        const themeColor = createThemeColor(['hsl(100,50%,50%)'])
        expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(100,50%,50%,0.5)')
      })

      test('Should update hsl alpha value', () => {
        const themeColor = createThemeColor(['hsl(100, 50%, 50%, 0.5)'])
        expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(100, 50%, 50%, 0.25)')
      })

      test('Should update hsl alpha percentage', () => {
        const themeColor = createThemeColor(['hsl(100, 50%, 50%, 50%)'])
        expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(100, 50%, 50%, 25%)')
      })
    })

    describe('separated by spaces', () => {
      test('Should set hsl alpha value', () => {
        const themeColor = createThemeColor(['hsl(100 50% 50%)'])
        expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(100 50% 50% / 0.5)')
      })

      test('Should update hsl alpha value', () => {
        const themeColor = createThemeColor(['hsl(100 50% 50% / 0.5)'])
        expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(100 50% 50% / 0.25)')
      })

      test('Should update hsl alpha percentage', () => {
        const themeColor = createThemeColor(['hsl(100 50% 50% / 50%)'])
        expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(100 50% 50% / 25%)')
      })
    })
  })
})

describe('list dynamic', () => {
  test('Should return item in hsl dynamic list', () => {
    const themeColor = createThemeColor([
      [180, 50, 75],
      [180, 50, 75, 0.5]
    ])
    expect(themeColor(0)).toBe('hsl(180,50%,75%,1)')
    expect(themeColor(1)).toBe('hsl(180,50%,75%,0.5)')
    expect(themeColor(2)).toBe('hsl(180,50%,75%,0.5)')
  })

  test('Should return item in hsl dynamic list within valid value ranges', () => {
    const themeColor = createThemeColor({
      color: 'hsl',
      list: [
        [-10, -10, -10, -1],
        [400, 120, 120, 1.5]
      ]
    })
    expect(themeColor(0)).toBe('hsl(0,0%,0%,0)')
    expect(themeColor(1)).toBe('hsl(360,100%,100%,1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in hsl dynamic list', () => {
      const themeColor = createThemeColor([
        [150, 50, 75],
        [150, 50, 75, 0.5],
        'hsl(150 50% 75% / 0.5)'
      ])
      expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(150,50%,75%,0.5)')
      expect(themeColor(1, { alpha: 0.5 })).toBe('hsl(150,50%,75%,0.25)')
      expect(themeColor(2, { alpha: 0.5 })).toBe('hsl(150 50% 75% / 0.25)')
      expect(themeColor(3, { alpha: 0.5 })).toBe('hsl(150 50% 75% / 0.25)')
    })
  })
})

describe('function', () => {
  test('Should return item in hsl creator', () => {
    const themeColor = createThemeColor((i) => [180, 50, 75 + i])
    expect(themeColor(0)).toBe('hsl(180,50%,75%,1)')
    expect(themeColor(1)).toBe('hsl(180,50%,76%,1)')
  })

  test('Should return item in hsl creator (object definition)', () => {
    const themeColor = createThemeColor({
      color: 'hsl',
      create: (i) => [180, 50, 75 + i]
    })
    expect(themeColor(0)).toBe('hsl(180,50%,75%,1)')
    expect(themeColor(1)).toBe('hsl(180,50%,76%,1)')
  })

  test('Should return item in hsl creator with valid ranges', () => {
    const themeColor = createThemeColor((index) => [180, 50 * index, 50 * index, 0.5 * index])
    expect(themeColor(0)).toBe('hsl(180,0%,0%,0)')
    expect(themeColor(1)).toBe('hsl(180,50%,50%,0.5)')
    expect(themeColor(2)).toBe('hsl(180,100%,100%,1)')
    expect(themeColor(3)).toBe('hsl(180,100%,100%,1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in hsl creator', () => {
      const themeColor = createThemeColor((index) => [0, 50, 50, 0.5 * index])
      expect(themeColor(0, { alpha: 0.5 })).toBe('hsl(0,50%,50%,0)')
      expect(themeColor(1, { alpha: 0.5 })).toBe('hsl(0,50%,50%,0.25)')
      expect(themeColor(2, { alpha: 0.5 })).toBe('hsl(0,50%,50%,0.5)')
    })
  })
})
