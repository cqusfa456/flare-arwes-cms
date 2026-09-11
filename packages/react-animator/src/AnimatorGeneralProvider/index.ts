import { memo } from '@arwes/react-tools'
import { AnimatorGeneralProvider as Component } from './AnimatorGeneralProvider.js'

// TODO: Optimize props comparision.
const AnimatorGeneralProvider = memo(Component)

export * from './AnimatorGeneralProvider.js'
export { AnimatorGeneralProvider }
