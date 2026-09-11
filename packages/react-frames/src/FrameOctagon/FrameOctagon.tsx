import React, { useMemo } from 'react'
import { cx } from '@arwes/tools'
import { memo } from '@arwes/react-tools'
import { type CreateFrameOctagonSettingsProps, createFrameOctagonSettings } from '@arwes/frames'

import { type FrameBaseProps, FrameBase } from '../FrameBase/index.js'

type FrameOctagonProps = Omit<FrameBaseProps, 'settings'> & CreateFrameOctagonSettingsProps

const FrameOctagon = memo((props: FrameOctagonProps): JSX.Element => {
  const {
    styled,
    animated,
    padding,
    leftTop,
    rightTop,
    rightBottom,
    leftBottom,
    squareSize,
    strokeWidth
  } = props

  const settings = useMemo(
    () =>
      createFrameOctagonSettings({
        styled,
        animated,
        padding,
        leftTop,
        rightTop,
        rightBottom,
        leftBottom,
        squareSize,
        strokeWidth
      }),
    [styled, animated, padding, leftTop, rightTop, rightBottom, leftBottom, squareSize, strokeWidth]
  )

  return (
    <FrameBase
      {...props}
      className={cx('arwes-frames-frameoctagon', props.className)}
      settings={settings}
    />
  )
})

export type { FrameOctagonProps }
export { FrameOctagon }
