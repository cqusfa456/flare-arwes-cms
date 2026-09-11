/* istanbul ignore file */

import { vi, beforeEach, afterEach } from 'vitest'

type MoveTimeTo = (timeToMoveSeconds: number) => void

function setupTimers(): void {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'Date',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'queueMicrotask'
      ]
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
}

function createMoveTimeTo(): MoveTimeTo {
  let currentTimeMoved = 0

  function moveTimeTo(timeToMoveSeconds: number): void {
    const timeToMoveMs = timeToMoveSeconds * 1_000
    const timeOffset = timeToMoveMs - currentTimeMoved

    if (timeOffset < 0) {
      throw new Error('Time to move must be greater than current time moved.')
    }

    currentTimeMoved = timeToMoveMs

    vi.advanceTimersByTime(timeOffset)
  }

  return moveTimeTo
}

export type { MoveTimeTo }
export { setupTimers, createMoveTimeTo }
