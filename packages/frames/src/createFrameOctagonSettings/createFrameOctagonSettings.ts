import { filterProps } from '@arwes/tools'
import type { FrameSettingsPathDefinition, FrameSettings } from '../types.js'

type CreateFrameOctagonSettingsProps = {
  styled?: boolean
  animated?: boolean
  leftTop?: boolean
  rightTop?: boolean
  rightBottom?: boolean
  leftBottom?: boolean
  squareSize?: number
  padding?: number
  strokeWidth?: number
}

const defaultProps: Required<CreateFrameOctagonSettingsProps> = {
  styled: true,
  animated: true,
  padding: 0,
  leftTop: true,
  rightTop: true,
  rightBottom: true,
  leftBottom: true,
  squareSize: 16,
  strokeWidth: 1
}

const createFrameOctagonSettings = (props?: CreateFrameOctagonSettingsProps): FrameSettings => {
  const {
    styled,
    animated,
    padding: p,
    leftTop,
    rightTop,
    rightBottom,
    leftBottom,
    squareSize,
    strokeWidth
  } = { ...defaultProps, ...(props ? filterProps(props) : null) }

  const so = strokeWidth / 2

  return {
    elements: [
      {
        type: 'path',
        name: 'bg',
        style: {
          filter: styled ? 'var(--arwes-frames-bg-filter)' : undefined,
          fill: styled ? 'var(--arwes-frames-bg-color, currentcolor)' : undefined,
          strokeWidth: 0
        },
        animated: animated && ['fade'],
        path: [
          ...(leftTop
            ? [
                ['M', p + so, p + so + squareSize],
                ['l', squareSize, -squareSize]
              ]
            : [['M', p + so, p + so]]),
          ...(rightTop
            ? [
                ['H', `100% - ${p + so + squareSize}`],
                ['l', squareSize, squareSize]
              ]
            : [['H', `100% - ${p + so}`]]),
          ...(rightBottom
            ? [
                ['V', `100% - ${p + so + squareSize}`],
                ['l', -squareSize, squareSize]
              ]
            : [['V', `100% - ${p + so}`]]),
          ...(leftBottom
            ? [
                ['H', p + so + squareSize],
                ['l', -squareSize, -squareSize]
              ]
            : [['H', p + so]]),
          'Z'
        ] as FrameSettingsPathDefinition
      },
      {
        type: 'g',
        style: {
          filter: styled ? 'var(--arwes-frames-line-filter)' : undefined,
          fill: styled ? 'none' : undefined,
          stroke: styled ? 'var(--arwes-frames-line-color, currentcolor)' : undefined,
          strokeLinecap: styled ? 'round' : undefined,
          strokeLinejoin: styled ? 'round' : undefined,
          strokeWidth: String(strokeWidth)
        },
        elements: [
          // Left Top > Right Top > Right Bottom
          {
            type: 'path',
            name: 'line',
            animated: animated && ['draw'],
            path: [
              ...(leftTop
                ? [
                    ['M', p + so, p + so + squareSize],
                    ['l', squareSize, -squareSize]
                  ]
                : [['M', p + so, p + so]]),
              ...(rightTop
                ? [
                    ['H', `100% - ${p + so + squareSize}`],
                    ['l', squareSize, squareSize]
                  ]
                : [['H', `100% - ${p + so}`]]),
              ...(rightBottom
                ? [['V', `100% - ${p + so + squareSize}`]]
                : [['V', `100% - ${p + so}`]])
            ] as FrameSettingsPathDefinition
          },
          // Right Bottom > Left Bottom > Left Top
          {
            type: 'path',
            name: 'line',
            animated: animated && ['draw'],
            path: [
              ...(rightBottom
                ? [
                    ['M', `100% - ${p + so}`, `100% - ${p + so + squareSize}`],
                    ['l', -squareSize, squareSize]
                  ]
                : [['M', `100% - ${p + so}`, `100% - ${p + so}`]]),
              ...(leftBottom
                ? [
                    ['H', p + so + squareSize],
                    ['l', -squareSize, -squareSize]
                  ]
                : [['H', p + so]]),
              ...(leftTop ? [['V', p + so + squareSize]] : [['V', p + so]])
            ] as FrameSettingsPathDefinition
          }
        ]
      }
    ]
  }
}

export type { CreateFrameOctagonSettingsProps }
export { createFrameOctagonSettings }
