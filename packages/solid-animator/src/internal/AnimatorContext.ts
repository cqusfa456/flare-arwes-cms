import { createContext } from 'solid-js'
import type { AnimatorInterface } from '@arwes/animator'

export const AnimatorContext = createContext<() => AnimatorInterface | undefined>()
