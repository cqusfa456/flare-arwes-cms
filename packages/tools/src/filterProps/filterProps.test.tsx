import { test, expect } from 'vitest'

import { filterProps } from './filterProps.js'

test('should return object without properties as undefineds and without mutating object', () => {
  const initial = {
    a: 1,
    b: true,
    c: false,
    d: 'x',
    e: null,
    f: [1, 2],
    g: { x: 1 },
    h: new Date('2024-10-10'),
    i: undefined,
    j: undefined
  }
  const initialKeysPre = Object.keys(initial)
  const initialValuesPre = Object.values(initial)

  const received = filterProps(initial)
  const expected = {
    a: 1,
    b: true,
    c: false,
    d: 'x',
    e: null,
    f: [1, 2],
    g: { x: 1 },
    h: new Date('2024-10-10')
  }
  expect(expected).toStrictEqual(received)

  const initialKeysPost = Object.keys(initial)
  const initialValuesPost = Object.values(initial)
  expect(initialKeysPre).toEqual(initialKeysPost)
  expect(initialValuesPre).toEqual(initialValuesPost)
})
