/* istanbul ignore file */

import type {
  AnimatorSystemRegisterSetup,
  AnimatorInterface,
  AnimatorSettingsPartial
} from '../src/types'
import { createAnimatorSystem } from '../src/createAnimatorSystem'

const createAnimator = (
  parentInterface?: AnimatorInterface,
  getSettings?: () => AnimatorSettingsPartial
): AnimatorInterface => {
  const setup: undefined | AnimatorSystemRegisterSetup = getSettings ? { getSettings } : undefined

  if (parentInterface) {
    const system = parentInterface.system
    const node = system.register(parentInterface.node, setup)
    return { system, node }
  }

  const system = createAnimatorSystem()
  const node = system.register(undefined, setup)
  return { system, node }
}

export { createAnimator }
