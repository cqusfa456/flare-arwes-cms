import { test, expect } from 'vitest'
import { createAnimation } from './createAnimation'

test('Should resolve animation on finish', async () => {
  const animation = createAnimation({
    duration: 0.1,
    onUpdate() {}
  })
  expect(animation.isPending()).toBe(true)
  await animation
  expect(animation.isPending()).toBe(false)
})

test('Should resolve animation on complete', async () => {
  const animation = createAnimation({
    duration: 100, // Too big a duration so it can be completed quickly.
    onUpdate() {}
  })
  expect(animation.isPending()).toBe(true)
  animation.complete()
  await animation
  expect(animation.isPending()).toBe(false)
})

test('Should resolve animation on cancel', async () => {
  const animation = createAnimation({
    duration: 0.1,
    onUpdate() {}
  })
  expect(animation.isPending()).toBe(true)
  animation.cancel()
  await animation
  expect(animation.isPending()).toBe(false)
})
