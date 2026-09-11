import React, { memo } from 'react'
import {
  type AnimatedProp,
  type StyleSeparatorProps,
  Animated,
  cx,
  styleSeparator
} from '@arwes/react'

import { theme } from '@/config'

type HrProps = Omit<StyleSeparatorProps, 'colorStatic' | 'colorActive'> & {
  className?: string
  color?: 'primary' | 'secondary' | 'neutral' | 'error'
  size?: 1 | 2
  animated?: AnimatedProp
}

const Hr = memo((props: HrProps): JSX.Element => {
  const { className, color = 'primary', size = 1, direction, isVertical, animated } = props

  const colorFn =
    color === 'primary'
      ? theme.colors.primary.main
      : color === 'secondary'
        ? theme.colors.secondary.main
        : color === 'error'
          ? theme.colors.error
          : theme.colors.neutral

  const colorStatic = colorFn(9, { alpha: 0.8 })
  const colorActive = colorFn(7, { alpha: 0.8 })

  return (
    <Animated
      as="hr"
      className={cx(
        'block outline-none border-none',
        !isVertical && 'w-full',
        !isVertical && size === 1 && 'h-[1px]',
        !isVertical && size === 2 && 'h-[2px]',
        isVertical && 'h-full',
        isVertical && size === 1 && 'w-[1px]',
        isVertical && size === 2 && 'w-[2px]',
        className
      )}
      style={{
        background: styleSeparator({ colorStatic, colorActive, direction, isVertical })
      }}
      animated={animated}
    />
  )
})

export type { HrProps }
export { Hr }
