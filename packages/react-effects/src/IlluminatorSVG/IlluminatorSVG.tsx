import React, {
  type ReactElement,
  type ForwardedRef,
  type SVGProps,
  type RefObject,
  useEffect,
  useRef
} from 'react'
import { cx } from '@arwes/tools'
import { memo, mergeRefs } from '@arwes/react-tools'
import { type CreateEffectIlluminatorSVGProps, createEffectIlluminatorSVG } from '@arwes/effects'

interface IlluminatorSVGProps
  extends SVGProps<SVGGElement>,
    Omit<CreateEffectIlluminatorSVGProps, 'svg' | 'container' | 'className' | 'style'> {
  elementRef?: ForwardedRef<SVGGElement>
  svgRef: RefObject<SVGSVGElement>
  color?: string
  size?: number
}

const IlluminatorSVG = memo((props: IlluminatorSVGProps): ReactElement => {
  const { elementRef, svgRef, color, size, ...otherProps } = props

  const containerRef = useRef<SVGGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current

    if (!svg || !container) {
      return
    }

    const effect = createEffectIlluminatorSVG({ svg, container, size, color })

    return () => effect.cancel()
  }, [size, color])

  return (
    <g
      ref={mergeRefs(containerRef, elementRef)}
      {...otherProps}
      className={cx('arwes-frames-illuminatorsvg', otherProps.className)}
      style={{
        pointerEvents: 'none',
        ...otherProps.style
      }}
    ></g>
  )
})

export type { IlluminatorSVGProps }
export { IlluminatorSVG }
