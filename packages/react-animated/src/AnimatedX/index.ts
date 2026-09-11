import { createElement, memo, forwardRef } from 'react'

import { AnimatedX as Component } from './AnimatedX.js'

const AnimatedX: typeof Component = memo(
  forwardRef((props: any, forwardedRef: any) =>
    createElement(Component as any, {
      elementRef: forwardedRef,
      ...props
    })
  )
  // TODO: Compare the `animated` value for object or collection differences for performance.
) as any

export * from './AnimatedX.js'
export { AnimatedX }
