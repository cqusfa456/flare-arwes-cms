import { test, expect, beforeEach } from 'vitest'

import { type MoveTimeTo, setupTimers, createMoveTimeTo } from '../../__testUtils__/timers'
import { createAnimator } from '../../__testUtils__/nodes'

setupTimers()

let moveTimeTo: MoveTimeTo

beforeEach(() => {
  moveTimeTo = createMoveTimeTo()
})

test('Should create parent combine nested children with combine and get dynamic durations', async () => {
  const parent = createAnimator(undefined, () => ({ combine: true, manager: 'parallel' }))

  const childA = createAnimator(parent, () => ({ combine: true, manager: 'sequence' }))
  const granchildA1 = createAnimator(childA)
  const granchildA2 = createAnimator(childA)

  const childB = createAnimator(parent, () => ({ combine: true, manager: 'stagger' }))
  const granchildB1 = createAnimator(childB)
  const granchildB2 = createAnimator(childB)

  const childC = createAnimator(parent, () => ({ combine: true, manager: 'parallel' }))
  const granchildC1 = createAnimator(childC)
  const granchildC2 = createAnimator(childC)

  queueMicrotask(() => granchildB1.node.send('setup'))
  queueMicrotask(() => granchildB2.node.send('setup'))
  queueMicrotask(() => childB.node.send('setup'))

  queueMicrotask(() => granchildA1.node.send('setup'))
  queueMicrotask(() => granchildA2.node.send('setup'))
  queueMicrotask(() => childA.node.send('setup'))

  queueMicrotask(() => granchildC1.node.send('setup'))
  queueMicrotask(() => granchildC2.node.send('setup'))
  queueMicrotask(() => childC.node.send('setup'))

  queueMicrotask(() => parent.node.send('setup'))

  moveTimeTo(0)

  expect(granchildA1.node.settings.duration.enter).toBe(0.4)
  expect(granchildA2.node.settings.duration.enter).toBe(0.4)
  expect(childA.node.settings.duration.enter).toBe(0.8)

  expect(granchildB1.node.settings.duration.enter).toBe(0.4)
  expect(granchildB2.node.settings.duration.enter).toBe(0.4)
  expect(childB.node.settings.duration.enter).toBe(0.44)

  expect(granchildC1.node.settings.duration.enter).toBe(0.4)
  expect(granchildC2.node.settings.duration.enter).toBe(0.4)
  expect(childC.node.settings.duration.enter).toBe(0.4)

  expect(parent.node.settings.duration.enter).toBe(0.8)
})
