import React, { useMemo } from 'react'
import { cx } from '@arwes/tools'
import { memo } from '@arwes/react-tools'
import { type CreateFrameNefrexSettingsProps, createFrameNefrexSettings } from '@arwes/frames'

import { type FrameBaseProps, FrameBase } from '../FrameBase/index.js'

type FrameNefrexProps = Omit<FrameBaseProps, 'settings'> & CreateFrameNefrexSettingsProps

const FrameNefrex = memo((props: FrameNefrexProps): JSX.Element => {
  const {
    styled,
    animated,
    padding,
    leftTop,
    leftBottom,
    rightTop,
    rightBottom,
    squareSize,
    strokeWidth,
    smallLineLength,
    largeLineLength
  } = props

  const settings = useMemo(
    () =>
      createFrameNefrexSettings({
        styled,
        animated,
        padding,
        leftTop,
        leftBottom,
        rightTop,
        rightBottom,
        squareSize,
        strokeWidth,
        smallLineLength,
        largeLineLength
      }),
    [
      styled,
      animated,
      padding,
      leftTop,
      leftBottom,
      rightTop,
      rightBottom,
      squareSize,
      strokeWidth,
      smallLineLength,
      largeLineLength
    ]
  )

  return (
    <FrameBase
      {...props}
      className={cx('arwes-frames-framenefrex', props.className)}
      settings={settings}
    />
  )
})

export type { FrameNefrexProps }
export { FrameNefrex }
