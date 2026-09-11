import type { Easing } from '@arwes/animated'

export type AnimateTextManager = 'sequence' | 'decipher'

export type AnimateTextProps = {
  rootElement: HTMLElement
  contentElement: HTMLElement
  /**
   * Transition duration in seconds.
   */
  duration: number
  easing?: Easing
  isEntering?: boolean
  hideOnExited?: boolean
  hideOnEntered?: boolean
}
