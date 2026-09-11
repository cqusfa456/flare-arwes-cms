import { test, expect } from 'vitest'

import { easeAmong } from './easeAmong'

test('Should return first value if 0', () => {
  expect(easeAmong([5, 10])(0)).toBe(5)
})

test('Should return last value if 1', () => {
  expect(easeAmong([5, 10])(1)).toBe(10)
})

test('Should return percentage among two values', () => {
  const easing = easeAmong([5, 10])
  expect(easing(0)).toBe(5)
  expect(easing(0.25)).toBe(6.25)
  expect(easing(0.5)).toBe(7.5)
  expect(easing(0.75)).toBe(8.75)
  expect(easing(1)).toBe(10)
})

test('Should return percentage among ascending and descending values', () => {
  const easing = easeAmong([4, 10, 2])
  expect(easing(0)).toBe(4) // 4 + (10 - 4) * 0
  expect(easing(0.2)).toBe(6.4) // 4 + (10 - 4) * 0.4
  expect(easing(0.25)).toBe(7) // 4 + (10 - 4) * 0.5
  expect(easing(0.4)).toBe(8.8) // 4 + (10 - 4) * 0.8
  expect(easing(0.5)).toBe(10) // 10 - (10 - 2) * 0
  expect(easing(0.6)).toBe(8.4) // 10 - (10 - 2) * 0.2
  expect(easing(0.75)).toBe(6) // 10 - (10 - 2) * 0.5
  expect(easing(0.8)).toBe(5.199999999999999) // 10 - (10 - 2) * 0.6 (JavaScript Glitch)
  expect(easing(1)).toBe(2) // 10 - (10 - 2) * 1
})

test('Should return percentage among multiple values', () => {
  const easing = easeAmong([1, 2, 3, 4, 5])
  expect(easing(0)).toBe(1)
  expect(easing(0.25)).toBe(2)
  expect(easing(0.3)).toBe(2.2)
  expect(easing(0.5)).toBe(3)
  expect(easing(0.6)).toBe(3.4)
  expect(easing(0.75)).toBe(4)
  expect(easing(1)).toBe(5)
})
