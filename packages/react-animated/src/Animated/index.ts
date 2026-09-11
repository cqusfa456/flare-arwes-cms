import { createElement, memo, forwardRef } from 'react'

import { Animated as Component } from './Animated.js'

const Animated: typeof Component = memo(
  forwardRef((props: any, forwardedRef: any) =>
    createElement(Component as any, {
      elementRef: forwardedRef,
      ...props
    })
  )
  // TODO: Compare the `animated` value for object or collection differences for performance.
) as any

export * from './Animated.js'
export { Animated }
