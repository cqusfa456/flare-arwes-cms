import { type MutableRefObject, useRef, useEffect } from 'react'
import {
  type AnimatedElementPropsSettings,
  type AnimatedProp,
  createAnimatedElement
} from '@arwes/animated'
import { useAnimator } from '@arwes/react-animator'

const useAnimated = <Element extends HTMLElement | SVGElement = HTMLElement>(
  elementRef: MutableRefObject<Element | null>,
  animated: undefined | AnimatedProp,
  settings?: undefined | Omit<AnimatedElementPropsSettings<Element>, 'animated'>
): void => {
  const animator = useAnimator()
  const settingsRef = useRef<AnimatedElementPropsSettings<Element>>({ animated: undefined })

  settingsRef.current = {
    ...settings,
    animated
  }

  useEffect(() => {
    const element = elementRef.current

    if (!element || !animator) {
      return
    }

    const animatedElement = createAnimatedElement({
      element,
      animator: animator.node,
      settingsRef
    })

    return () => animatedElement.cancel()
  }, [animator])
}

export { useAnimated }
