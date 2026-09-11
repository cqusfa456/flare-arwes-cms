import { describe, test, expect } from 'vitest'

import { createThemeColor } from './createThemeColor'

describe('static list', () => {
  test('Should return item in rgb static list', () => {
    const themeColor = createThemeColor(['rgb(100,100,100)', 'rgb(100,100,200)'])
    expect(themeColor(0)).toBe('rgb(100,100,100)')
    expect(themeColor(1)).toBe('rgb(100,100,200)')
    expect(themeColor(3)).toBe('rgb(100,100,200)')
  })

  describe('alpha', () => {
    test('Should set rgb alpha value', () => {
      const themeColor = createThemeColor(['rgb(100,100,100)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('rgb(100,100,100,0.5)')
    })

    test('Should update rgb alpha value', () => {
      const themeColor = createThemeColor(['rgb(100,100,100,0.5)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('rgb(100,100,100,0.25)')
    })

    test('Should update rgb alpha percentage', () => {
      const themeColor = createThemeColor(['rgb(100,100,100,50%)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('rgb(100,100,100,25%)')
    })

    test('Should update rgb slash alpha value', () => {
      const themeColor = createThemeColor(['rgb(100,100,100 / 0.5)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('rgb(100,100,100 / 0.25)')
    })

    test('Should update rgb slash alpha percentage', () => {
      const themeColor = createThemeColor(['rgb(100,100,100 / 50%)'])
      expect(themeColor(0, { alpha: 0.5 })).toBe('rgb(100,100,100 / 25%)')
    })
  })
})

describe('dynamic list', () => {
  test('Should return item in rgb dynamic list', () => {
    const themeColor = createThemeColor({
      color: 'rgb',
      list: [[50, 50, 50], [50, 50, 60, 0.5], 'rgb(50%,50%,100%,0.5)']
    })
    expect(themeColor(0)).toBe('rgb(50%,50%,50%,1)')
    expect(themeColor(1)).toBe('rgb(50%,50%,60%,0.5)')
    expect(themeColor(2)).toBe('rgb(50%,50%,100%,0.5)')
    expect(themeColor(3)).toBe('rgb(50%,50%,100%,0.5)')
  })

  test('Should return item in rgb dynamic list within valid value ranges', () => {
    const themeColor = createThemeColor({
      color: 'rgb',
      list: [
        [-10, -10, -10, -1],
        [120, 120, 120, 1.5]
      ]
    })
    expect(themeColor(0)).toBe('rgb(0%,0%,0%,0)')
    expect(themeColor(1)).toBe('rgb(100%,100%,100%,1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in rgb dynamic list', () => {
      const themeColor = createThemeColor({
        color: 'rgb',
        list: [[50, 50, 50], [50, 50, 60, 0.5], 'rgb(50%,50%,100%,0.5)']
      })
      expect(themeColor(0, { alpha: 0.5 })).toBe('rgb(50%,50%,50%,0.5)')
      expect(themeColor(1, { alpha: 0.5 })).toBe('rgb(50%,50%,60%,0.25)')
      expect(themeColor(2, { alpha: 0.5 })).toBe('rgb(50%,50%,100%,0.25)')
    })
  })
})

describe('function', () => {
  test('Should return item in rgb creator', () => {
    const themeColor = createThemeColor({
      color: 'rgb',
      create: (i) => [50, 75, i * 10, 0.9]
    })
    expect(themeColor(0)).toBe('rgb(50%,75%,0%,0.9)')
    expect(themeColor(1)).toBe('rgb(50%,75%,10%,0.9)')
    expect(themeColor(2)).toBe('rgb(50%,75%,20%,0.9)')
  })

  test('Should return item in rgb creator with valid ranges', () => {
    const themeColor = createThemeColor({
      color: 'rgb',
      create: (i) => [50, 50 * i, 50 * i, 0.5 * i]
    })
    expect(themeColor(0)).toBe('rgb(50%,0%,0%,0)')
    expect(themeColor(1)).toBe('rgb(50%,50%,50%,0.5)')
    expect(themeColor(2)).toBe('rgb(50%,100%,100%,1)')
    expect(themeColor(3)).toBe('rgb(50%,100%,100%,1)')
  })

  describe('alpha', () => {
    test('Should update alpha and return item in rgb creator', () => {
      const themeColor = createThemeColor({
        color: 'rgb',
        create: (i) => [50, 75, i * 10, 0.5]
      })
      expect(themeColor(1, { alpha: 0.5 })).toBe('rgb(50%,75%,10%,0.25)')
      expect(themeColor(2, { alpha: 1 })).toBe('rgb(50%,75%,20%,0.5)')
    })
  })
})
