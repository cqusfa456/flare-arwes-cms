import type { Easing } from '../types.js'
import { easing } from '../easing/index.js'

interface AnimationProps {
  /**
   * Duration in seconds.
   */
  duration: number
  easing?: Easing
  direction?: 'normal' | 'reverse'
  /**
   * Number of times to repeat the animation.
   * Set to `Infinity` to repeat undefinitely.
   */
  repeat?: number
  onUpdate: (progress: number) => void
  onFinish?: () => void
  onCancel?: () => void
}

interface Animation {
  then: (callback?: () => void) => Promise<void>
  isPending: () => boolean
  cancel: () => void
  complete: () => void
}

const createAnimation = (props: AnimationProps): Animation => {
  if (props.duration !== undefined && props.duration < 0) {
    throw new Error('Arwes createAnimation() does not support negative durations.')
  }

  const {
    duration: durationProvided,
    easing: easingName = 'outSine',
    direction = 'normal',
    repeat = 0,
    onUpdate,
    onFinish,
    onCancel
  } = props

  const ease = typeof easingName === 'function' ? easingName : easing[easingName]
  const duration = durationProvided * 1_000 // seconds to ms

  let currentAnimationFrame: number | null = null
  let start: number
  let slapsed = 0
  let done: () => void
  let repetitions = 0

  const promise = new Promise<void>((resolve) => {
    done = resolve
  })

  const then = (callback?: () => void): Promise<void> => promise.then(callback)

  const nextAnimation = (timestamp: number): void => {
    if (!start) {
      start = timestamp
    }

    slapsed = Math.max(timestamp - start, 0)

    const progress = ease(duration === 0 ? 1 : Math.min(1, Math.max(0, slapsed / duration)))

    onUpdate(direction === 'normal' ? progress : 1 - progress)

    let continueAnimation = duration > 0 && slapsed < duration

    if (!continueAnimation && repeat > 0 && repetitions < repeat) {
      start = timestamp
      continueAnimation = true
      repetitions++
    }

    if (continueAnimation) {
      currentAnimationFrame = window.requestAnimationFrame(nextAnimation)
    } else {
      currentAnimationFrame = null
      onFinish?.()
      done()
    }
  }

  const isPending = (): boolean => {
    return currentAnimationFrame !== null
  }

  const cancel = (): void => {
    if (currentAnimationFrame !== null) {
      window.cancelAnimationFrame(currentAnimationFrame)
      currentAnimationFrame = null
      onCancel?.()
      done()
    }
  }

  const complete = (): void => {
    if (currentAnimationFrame !== null) {
      window.cancelAnimationFrame(currentAnimationFrame)
      currentAnimationFrame = null
      onUpdate(ease(direction === 'reverse' ? 0 : 1))
      onFinish?.()
      done()
    }
  }

  currentAnimationFrame = window.requestAnimationFrame(nextAnimation)

  return Object.freeze({ then, isPending, cancel, complete })
}

export type { AnimationProps, Animation }
export { createAnimation }
