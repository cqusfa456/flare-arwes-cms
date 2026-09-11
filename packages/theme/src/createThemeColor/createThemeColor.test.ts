import { describe, test, expect } from 'vitest'

import { createThemeColor } from './createThemeColor'

test('Should accept list of string colors and return by index', () => {
  const themeColor = createThemeColor(['a', 'b', 'c'])
  expect(themeColor(0)).toBe('a')
  expect(themeColor(1)).toBe('b')
  expect(themeColor(2)).toBe('c')
})

test('Should return the last available item if index exceeds', () => {
  const themeColor = createThemeColor(['a', 'b', 'c'])
  expect(themeColor(3)).toBe('c')
  expect(themeColor(4)).toBe('c')
})

test('Should return empty string if empty list is provided', () => {
  const themeColor = createThemeColor([])
  expect(themeColor(0)).toBe('')
  expect(themeColor(1)).toBe('')
})

describe('alpha', () => {
  test('Should not update alpha in not applicable colors', () => {
    const themeColor = createThemeColor([
      'red',
      'blue',
      'currentcolor',
      'transparent',
      '#17c',
      '#1177cc',
      '#1177ccaa'
    ])
    expect(themeColor(0, { alpha: 0.5 })).toBe('red')
    expect(themeColor(1, { alpha: 0.5 })).toBe('blue')
    expect(themeColor(2, { alpha: 0.5 })).toBe('currentcolor')
    expect(themeColor(3, { alpha: 0.5 })).toBe('transparent')
    expect(themeColor(4, { alpha: 0.5 })).toBe('#17c')
    expect(themeColor(5, { alpha: 0.5 })).toBe('#1177cc')
    expect(themeColor(6, { alpha: 0.5 })).toBe('#1177ccaa')
  })
})
