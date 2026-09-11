import type { EasingFn } from '../types.js'

const easeSteps =
  (steps: number, direction: 'start' | 'end' = 'end'): EasingFn =>
  (progress: number): number => {
    if (progress === 0 || progress === 1) {
      return progress
    }

    progress = direction === 'end' ? Math.min(progress, 0.999) : Math.max(progress, 0.001)

    const expanded = progress * steps
    const rounded = direction === 'end' ? Math.floor(expanded) : Math.ceil(expanded)

    return Math.min(1, Math.max(0, rounded / steps))
  }

export { easeSteps }
