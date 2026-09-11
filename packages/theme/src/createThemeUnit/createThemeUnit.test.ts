import { test, expect } from 'vitest'

import { createThemeUnit } from './createThemeUnit'

test('Should return result of unit', () => {
  const unit = createThemeUnit((i) => `${i * 3}px`)
  expect(unit(0)).toBe('0px')
  expect(unit(1)).toBe('3px')
  expect(unit(2)).toBe('6px')
  expect(unit(3)).toBe('9px')
})

test('Should return list of results of unit', () => {
  const unit = createThemeUnit((i) => `${i * 3}rem`)
  expect(unit([])).toBe('')
  expect(unit([2])).toBe('6rem')
  expect(unit([0, 2])).toBe('0rem 6rem')
  expect(unit([1, 1])).toBe('3rem 3rem')
  expect(unit([3, 0, 2])).toBe('9rem 0rem 6rem')
})

test('Should return element in provided list', () => {
  const unit = createThemeUnit(['0px', '1px', '2px', '4px', '8px'])
  expect(unit(0)).toBe('0px')
  expect(unit(1)).toBe('1px')
  expect(unit(2)).toBe('2px')
  expect(unit(3)).toBe('4px')
  expect(unit(4)).toBe('8px')
})

test('Should return list of elements in provided list', () => {
  const unit = createThemeUnit(['0px', '1px', '2px', '4px', '8px'])
  expect(unit([])).toBe('')
  expect(unit([2])).toBe('2px')
  expect(unit([0, 2])).toBe('0px 2px')
  expect(unit([1, 1])).toBe('1px 1px')
  expect(unit([3, 0, 2])).toBe('4px 0px 2px')
})

test('Should return last element in provided list if index exceeds', () => {
  const unit = createThemeUnit(['0px', '1px', '2px'])
  expect(unit(0)).toBe('0px')
  expect(unit(1)).toBe('1px')
  expect(unit(2)).toBe('2px')
  expect(unit(3)).toBe('2px')
  expect(unit(4)).toBe('2px')
})

test('Should return same string if provided string', () => {
  const unit = createThemeUnit((i) => `${i * 2}rem`)
  expect(unit('auto')).toBe('auto')
  expect(unit([2, 'auto', 1])).toBe('4rem auto 2rem')
})

test('Should return empty string if empty list and provided', () => {
  const unit = createThemeUnit([])
  expect(unit(0)).toBe('')
  expect(unit(1)).toBe('')
})
