import { memo } from '@arwes/react-tools'
import { Animator as Component } from './Animator.js'

// TODO: Optimize props comparision.
const Animator = memo(Component)

export * from './Animator.js'
export { Animator }
