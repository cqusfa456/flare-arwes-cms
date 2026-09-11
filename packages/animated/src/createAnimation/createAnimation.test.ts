import { vi, test, expect, beforeEach } from 'vitest'

import { type MoveTimeTo, setupTimers, createMoveTimeTo } from '../../__testUtils__/timers'
import { createAnimation } from './createAnimation'

setupTimers()

let moveTimeTo: MoveTimeTo

beforeEach(() => {
  moveTimeTo = createMoveTimeTo()
})

test('Should run animation', async () => {
  const update = vi.fn()
  const finish = vi.fn()
  const cancel = vi.fn()
  const progresses: Array<[number, number]> = []
  const animation = createAnimation({
    duration: 0.1,
    easing: 'linear',
    onUpdate: (progress) => {
      update(progress)
      progresses.push([performance.now(), progress])
    },
    onFinish: finish,
    onCancel: cancel
  })

  expect(animation.isPending()).toBe(true)

  moveTimeTo(0)
  expect(animation.isPending()).toBe(true)
  expect(update).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.097)
  expect(animation.isPending()).toBe(true)
  expect(update).toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.13)
  expect(animation.isPending()).toBe(false)
  expect(update).toHaveBeenCalled()
  expect(finish).toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  expect(progresses).toStrictEqual([
    [16, 0],
    [32, 0.16],
    [48, 0.32],
    [64, 0.48],
    [80, 0.64],
    [96, 0.8],
    [112, 0.96],
    [128, 1]
  ])
  progresses.forEach(([, progress]) => {
    expect(update).toHaveBeenCalledWith(progress)
  })
})

test('Should run animation with easing', async () => {
  const progresses: Array<[number, number]> = []
  createAnimation({
    duration: 0.1,
    easing: (x) => x * 2,
    onUpdate: (progress) => {
      progresses.push([performance.now(), progress])
    }
  })
  moveTimeTo(0.13)
  expect(progresses).toStrictEqual([
    [16, 0 * 2],
    [32, 0.16 * 2],
    [48, 0.32 * 2],
    [64, 0.48 * 2],
    [80, 0.64 * 2],
    [96, 0.8 * 2],
    [112, 0.96 * 2],
    [128, 1 * 2]
  ])
})

test('Should run animation with direction="reverse"', () => {
  const update = vi.fn()
  const finish = vi.fn()
  const cancel = vi.fn()
  const progresses: Array<[number, number]> = []
  const animation = createAnimation({
    duration: 0.1,
    easing: 'linear',
    direction: 'reverse',
    onUpdate: (progress) => {
      update(progress)
      progresses.push([performance.now(), progress])
    },
    onFinish: finish,
    onCancel: cancel
  })

  expect(animation.isPending()).toBe(true)

  moveTimeTo(0)
  expect(animation.isPending()).toBe(true)
  expect(update).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.097)
  expect(animation.isPending()).toBe(true)
  expect(update).toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.13)
  expect(animation.isPending()).toBe(false)
  expect(update).toHaveBeenCalled()
  expect(finish).toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  expect(progresses).toStrictEqual([
    [16, 1],
    [32, 0.84],
    [48, 0.6799999999999999], // JavaScript Glitch.
    [64, 0.52],
    [80, 0.36],
    [96, 0.19999999999999996], // JavaScript Glitch.
    [112, 0.040000000000000036], // JavaScript Glitch.
    [128, 0]
  ])
})

test('Should run animation with duration=0', () => {
  const update = vi.fn()
  const progresses: Array<[number, number]> = []
  createAnimation({
    duration: 0,
    easing: 'linear',
    onUpdate: (progress) => {
      update(progress)
      progresses.push([performance.now(), progress])
    }
  })
  moveTimeTo(1.03)
  expect(progresses).toStrictEqual([[16, 1]])
})

test('Should run animation with direction="reverse" & duration=0', () => {
  const update = vi.fn()
  const progresses: Array<[number, number]> = []
  createAnimation({
    duration: 0,
    easing: 'linear',
    direction: 'reverse',
    onUpdate: (progress) => {
      update(progress)
      progresses.push([performance.now(), progress])
    }
  })
  moveTimeTo(1.03)
  expect(progresses).toStrictEqual([[16, 0]])
})

test('Should throw on animation with duration < 0', () => {
  expect(() => {
    createAnimation({
      duration: -1,
      onUpdate: () => {}
    })
  }).toThrowError('Arwes createAnimation() does not support negative durations.')
})

test('Should run animation repeat', async () => {
  const progresses: Array<[number, number]> = []
  const animation = createAnimation({
    duration: 0.1,
    easing: 'linear',
    repeat: 2,
    onUpdate: (progress) => progresses.push([performance.now(), progress])
  })
  expect(animation.isPending()).toBe(true)
  moveTimeTo(0.13)
  expect(animation.isPending()).toBe(true)
  moveTimeTo(0.36)
  expect(animation.isPending()).toBe(false)
  expect(progresses).toStrictEqual([
    // Initial
    [16, 0],
    [32, 0.16],
    [48, 0.32],
    [64, 0.48],
    [80, 0.64],
    [96, 0.8],
    [112, 0.96],
    [128, 1],
    // First repeat
    [144, 0.16],
    [160, 0.32],
    [176, 0.48],
    [192, 0.64],
    [208, 0.8],
    [224, 0.96],
    [240, 1],
    // Second repeat
    [256, 0.16],
    [272, 0.32],
    [288, 0.48],
    [304, 0.64],
    [320, 0.8],
    [336, 0.96],
    [352, 1]
  ])
})

test('Should cancel animation', () => {
  const update = vi.fn()
  const finish = vi.fn()
  const cancel = vi.fn()
  const animation = createAnimation({
    duration: 1,
    onUpdate: update,
    onFinish: finish,
    onCancel: cancel
  })

  expect(animation.isPending()).toBe(true)

  moveTimeTo(0)
  expect(animation.isPending()).toBe(true)
  expect(update).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.5)
  expect(animation.isPending()).toBe(true)
  expect(update).toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  animation.cancel()
  expect(animation.isPending()).toBe(false)
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).toHaveBeenCalled()

  moveTimeTo(2)
  expect(animation.isPending()).toBe(false)
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).toHaveBeenCalled()
})

test('Should complete animation', () => {
  const update = vi.fn()
  const finish = vi.fn()
  const cancel = vi.fn()
  const animation = createAnimation({
    duration: 1,
    easing: 'linear',
    onUpdate: update,
    onFinish: finish,
    onCancel: cancel
  })

  expect(animation.isPending()).toBe(true)

  moveTimeTo(0)
  expect(animation.isPending()).toBe(true)
  expect(update).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.5)
  expect(animation.isPending()).toBe(true)
  expect(update).toHaveBeenCalled()
  expect(update).not.toHaveBeenCalledWith(1)
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  animation.complete()
  expect(animation.isPending()).toBe(false)
  expect(update).toHaveBeenCalledWith(1)
  expect(finish).toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(2)
  expect(animation.isPending()).toBe(false)
  expect(cancel).not.toHaveBeenCalled()
})

test('Should complete animation on direction="reverse"', () => {
  const update = vi.fn()
  const finish = vi.fn()
  const cancel = vi.fn()
  const animation = createAnimation({
    duration: 1,
    easing: 'linear',
    direction: 'reverse',
    onUpdate: update,
    onFinish: finish,
    onCancel: cancel
  })

  expect(animation.isPending()).toBe(true)

  moveTimeTo(0)
  expect(animation.isPending()).toBe(true)
  expect(update).not.toHaveBeenCalled()
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(0.5)
  expect(animation.isPending()).toBe(true)
  expect(update).toHaveBeenCalled()
  expect(update).not.toHaveBeenCalledWith(0)
  expect(finish).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  animation.complete()
  expect(animation.isPending()).toBe(false)
  expect(update).toHaveBeenCalledWith(0)
  expect(finish).toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()

  moveTimeTo(2)
  expect(animation.isPending()).toBe(false)
  expect(cancel).not.toHaveBeenCalled()
})
