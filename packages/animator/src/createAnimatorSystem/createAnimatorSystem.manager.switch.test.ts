import { test, expect, beforeEach } from 'vitest'

import { type MoveTimeTo, setupTimers, createMoveTimeTo } from '../../__testUtils__/timers'
import { createAnimator } from '../../__testUtils__/nodes'

setupTimers()

let moveTimeTo: MoveTimeTo

beforeEach(() => {
  moveTimeTo = createMoveTimeTo()
})

test('Should create parent and transition first child which condition is met', async () => {
  const parent = createAnimator(undefined, () => ({ manager: 'switch' }))
  const child1 = createAnimator(parent, () => ({ condition: false }))
  const child2 = createAnimator(parent)
  const child3 = createAnimator(parent, () => ({ condition: false }))
  queueMicrotask(() => child1.node.send('setup'))
  queueMicrotask(() => child2.node.send('setup'))
  queueMicrotask(() => child3.node.send('setup'))
  queueMicrotask(() => parent.node.send('setup'))

  expect(parent.node.state).toBe('exited')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('exited')
  expect(child3.node.state).toBe('exited')
  moveTimeTo(0.001)
  expect(parent.node.state).toBe('entering')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('entering')
  expect(child3.node.state).toBe('exited')
  moveTimeTo(0.399)
  expect(parent.node.state).toBe('entering')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('entering')
  expect(child3.node.state).toBe('exited')
  moveTimeTo(0.401)
  expect(parent.node.state).toBe('entered')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('entered')
  expect(child3.node.state).toBe('exited')

  moveTimeTo(1)
  child1.node.control.setSettings({ condition: false })
  child2.node.control.setSettings({ condition: false })
  child3.node.control.setSettings({ condition: true })
  parent.node.send('refresh')
  moveTimeTo(1.001)
  expect(parent.node.state).toBe('entered')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('exiting')
  expect(child3.node.state).toBe('exited')
  moveTimeTo(1.399)
  expect(parent.node.state).toBe('entered')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('exiting')
  expect(child3.node.state).toBe('exited')
  moveTimeTo(1.401)
  expect(parent.node.state).toBe('entered')
  expect(child1.node.state).toBe('exited')
  expect(child2.node.state).toBe('exited')
  expect(child3.node.state).toBe('entering')
})
