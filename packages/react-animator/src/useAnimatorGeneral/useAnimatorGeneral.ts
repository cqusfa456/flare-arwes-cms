import { useContext } from 'react'

import type { AnimatorGeneralInterface } from '../types.js'
import { AnimatorGeneralContext } from '../internal/AnimatorGeneralContext/index.js'

const useAnimatorGeneral = (): AnimatorGeneralInterface | undefined => {
  return useContext(AnimatorGeneralContext)
}

export { useAnimatorGeneral }
