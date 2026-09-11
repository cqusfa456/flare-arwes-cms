/* istanbul ignore file */

import { vi } from 'vitest'

type MoveTimeTo = (timeToMoveSeconds: number) => void

function makeMoveTimeTo(): MoveTimeTo {
  let currentTimeMoved = 0

  function jestMoveTimeTo(timeToMoveSeconds: number): void {
    const timeToMoveMs = timeToMoveSeconds * 1000
    const timeOffset = timeToMoveMs - currentTimeMoved

    if (timeOffset <= 0) {
      throw new Error('Time to move must be greater than current time moved.')
    }

    currentTimeMoved = timeToMoveMs

    vi.advanceTimersByTime(timeOffset)
  }

  return jestMoveTimeTo
}

export type { MoveTimeTo }
export { makeMoveTimeTo }
