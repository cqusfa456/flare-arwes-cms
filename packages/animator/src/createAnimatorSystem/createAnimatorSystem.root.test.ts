import { test, expect, beforeEach } from 'vitest'

import { type MoveTimeTo, setupTimers, createMoveTimeTo } from '../../__testUtils__/timers'
import { createAnimator } from '../../__testUtils__/nodes'

setupTimers()

let moveTimeTo: MoveTimeTo

beforeEach(() => {
  moveTimeTo = createMoveTimeTo()
})

test('Should create node and transition', async () => {
  const root = createAnimator()
  queueMicrotask(() => root.node.send('setup'))

  expect(root.node.state).toBe('exited')
  moveTimeTo(0.001)
  expect(root.node.state).toBe('entering')
  moveTimeTo(0.399)
  expect(root.node.state).toBe('entering')
  moveTimeTo(0.401)
  expect(root.node.state).toBe('entered')
  moveTimeTo(1)
  expect(root.node.state).toBe('entered')
})

test('Should create node with delay and transition', async () => {
  const root = createAnimator(undefined, () => ({ duration: { delay: 0.1 } }))
  queueMicrotask(() => root.node.send('setup'))

  expect(root.node.state).toBe('exited')
  moveTimeTo(0.001)
  expect(root.node.state).toBe('exited')
  moveTimeTo(0.099)
  expect(root.node.state).toBe('exited')
  moveTimeTo(0.101)
  expect(root.node.state).toBe('entering')
  moveTimeTo(0.499)
  expect(root.node.state).toBe('entering')
  moveTimeTo(0.501)
  expect(root.node.state).toBe('entered')
  moveTimeTo(1)
  expect(root.node.state).toBe('entered')
})
