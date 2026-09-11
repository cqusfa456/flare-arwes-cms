import { createContext } from 'react'

import type { AnimatorGeneralInterface } from '../../types.js'

const AnimatorGeneralContext = createContext<AnimatorGeneralInterface | undefined>(undefined)

export { AnimatorGeneralContext }
