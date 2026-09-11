import { vi, beforeEach, test, expect } from 'vitest'

import { type MoveTimeTo, makeMoveTimeTo } from '../../__testUtils__/makeMoveTimeTo'
import { createTOScheduler } from './createTOScheduler'

let moveTimeTo: MoveTimeTo

beforeEach(() => {
  vi.useFakeTimers()
  moveTimeTo = makeMoveTimeTo()
})

test('Should schedule a function call by given id, time, and callback', () => {
  const scheduler = createTOScheduler()
  const spy = vi.fn()
  scheduler.start('id', 0.1, spy)

  moveTimeTo(0.099)
  expect(spy).not.toHaveBeenCalled()

  moveTimeTo(0.101)
  expect(spy).toHaveBeenCalledTimes(1)
})

test('Should schedule a function call by given time and callback', () => {
  const scheduler = createTOScheduler()
  const spy = vi.fn()
  scheduler.start(0.1, spy)

  moveTimeTo(0.099)
  expect(spy).not.toHaveBeenCalled()

  moveTimeTo(0.101)
  expect(spy).toHaveBeenCalledTimes(1)
})

test('Should stop scheduled function call by id', () => {
  const scheduler = createTOScheduler()
  const spy = vi.fn()
  scheduler.start(0, 0.1, spy)

  moveTimeTo(0.099)
  scheduler.stop(0)
  expect(spy).not.toHaveBeenCalled()

  moveTimeTo(0.101)
  expect(spy).not.toHaveBeenCalled()
})

test('Should stop scheduled function call without id', () => {
  const scheduler = createTOScheduler()
  const spy = vi.fn()
  scheduler.start(0.1, spy)

  moveTimeTo(0.099)
  scheduler.stop()
  expect(spy).not.toHaveBeenCalled()

  moveTimeTo(0.101)
  expect(spy).not.toHaveBeenCalled()
})

test('Should re-set schedule function call if called multiple times', () => {
  const scheduler = createTOScheduler()
  const spy1 = vi.fn()
  const spy2 = vi.fn()
  scheduler.start(0, 0.1, spy1)

  moveTimeTo(0.05)
  scheduler.start(0, 0.1, spy2)

  moveTimeTo(0.149)
  expect(spy1).not.toHaveBeenCalled()
  expect(spy2).not.toHaveBeenCalled()

  moveTimeTo(0.151)
  expect(spy1).not.toHaveBeenCalled()
  expect(spy2).toHaveBeenCalledTimes(1)
})

test('Should be able to schedule multiple functions', () => {
  const scheduler = createTOScheduler()
  const spy1 = vi.fn()
  const spy2 = vi.fn()
  scheduler.start(0, 0.1, spy1)
  scheduler.start(1, 0.1, spy2)

  moveTimeTo(0.099)
  expect(spy1).not.toHaveBeenCalled()
  expect(spy2).not.toHaveBeenCalled()

  moveTimeTo(0.101)
  expect(spy1).toHaveBeenCalledTimes(1)
  expect(spy2).toHaveBeenCalledTimes(1)
})

test('Should be able to stop all scheduled functions', () => {
  const scheduler = createTOScheduler()
  const spy1 = vi.fn()
  const spy2 = vi.fn()
  scheduler.start(0, 0.1, spy1)
  scheduler.start(1, 0.1, spy2)

  moveTimeTo(0.01)
  scheduler.stopAll()

  moveTimeTo(0.11)
  expect(spy1).not.toHaveBeenCalled()
  expect(spy2).not.toHaveBeenCalled()
})
