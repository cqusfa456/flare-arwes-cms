import { useContext } from 'solid-js'
import { type AnimatorInterface } from '@arwes/animator'

import { AnimatorContext } from '../internal/AnimatorContext.js'

const useGetAnimator = (): (() => AnimatorInterface | undefined) | undefined => {
  return useContext(AnimatorContext)
}

export { useGetAnimator }
