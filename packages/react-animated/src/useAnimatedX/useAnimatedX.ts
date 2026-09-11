import { type MutableRefObject, useRef, useEffect } from 'react'
import {
  type AnimatedXProp,
  type AnimatedXElementPropsSettings,
  createAnimatedXElement
} from '@arwes/animated'

const useAnimatedX = <
  States extends string,
  Element extends HTMLElement | SVGElement = HTMLDivElement
>(
  state: undefined | null | States,
  elementRef: MutableRefObject<Element | null>,
  animated: undefined | AnimatedXProp<States>,
  settings?: Omit<AnimatedXElementPropsSettings<States>, 'state' | 'animated'>
): void => {
  const settingsRef = useRef({} as unknown as AnimatedXElementPropsSettings<States>)

  settingsRef.current = {
    ...settings,
    state: state!,
    animated
  }

  useEffect(() => {
    const element = elementRef.current

    if (state === undefined || state === null || !element) {
      return
    }

    const animatedXElement = createAnimatedXElement({ element, settingsRef })

    return () => animatedXElement.cancel()
  }, [state])
}

export { useAnimatedX }
