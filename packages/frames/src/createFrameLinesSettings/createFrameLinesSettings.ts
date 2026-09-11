import { filterProps } from '@arwes/tools'
import type { FrameSettingsPathDefinition, FrameSettings, FrameSettingsElement } from '../types.js'

type CreateFrameLinesSettingsProps = {
  styled?: boolean
  animated?: boolean
  padding?: number
  largeLineWidth?: number
  smallLineWidth?: number
  smallLineLength?: number
}

const defaultProps: Required<CreateFrameLinesSettingsProps> = {
  styled: true,
  animated: true,
  padding: 0,
  largeLineWidth: 1,
  smallLineWidth: 1,
  smallLineLength: 16
}

const createFrameLinesSettings = (props?: CreateFrameLinesSettingsProps): FrameSettings => {
  const {
    styled,
    animated,
    padding: p,
    largeLineWidth,
    smallLineWidth,
    smallLineLength
  } = { ...defaultProps, ...(props ? filterProps(props) : null) }

  const largePolylines: FrameSettingsPathDefinition[] = [
    // Top
    [
      ['M', p, p + largeLineWidth / 2],
      ['H', '50% + 0.1']
    ],
    [
      ['M', `100% - ${p + largeLineWidth / 2}`, p + largeLineWidth / 2],
      ['H', '50% - 0.1']
    ],

    // Bottom
    [
      ['M', p + largeLineWidth / 2, `100% - ${p + largeLineWidth / 2}`],
      ['H', '50% + 0.1']
    ],
    [
      ['M', `100% - ${p + largeLineWidth / 2}`, `100% - ${p + largeLineWidth / 2}`],
      ['H', '50% - 0.1']
    ]
  ]

  const smallPolylines: FrameSettingsPathDefinition[] = [
    // Top
    [
      ['M', p, p + smallLineWidth / 2],
      ['h', smallLineLength]
    ],
    [
      ['M', `100% - ${p}`, p + smallLineWidth / 2],
      ['h', -smallLineLength]
    ],

    // Bottom
    [
      ['M', p, `100% - ${p + smallLineWidth / 2}`],
      ['h', smallLineLength]
    ],
    [
      ['M', `100% - ${p}`, `100% - ${p + smallLineWidth / 2}`],
      ['h', -smallLineLength]
    ]
  ]

  return {
    elements: [
      {
        type: 'rect',
        name: 'bg',
        style: {
          filter: styled ? 'var(--arwes-frames-bg-filter)' : undefined,
          fill: styled ? 'var(--arwes-frames-bg-color, currentcolor)' : undefined,
          strokeWidth: 0
        },
        animated: animated && ['fade'],
        x: p,
        y: p,
        width: `100% - ${p * 2}`,
        height: `100% - ${p * 2}`
      },
      {
        type: 'g',
        style: {
          filter: styled ? 'var(--arwes-frames-line-filter)' : undefined,
          fill: styled ? 'none' : undefined,
          stroke: styled ? 'var(--arwes-frames-line-color, currentcolor)' : undefined,
          strokeWidth: String(largeLineWidth)
        },
        elements: largePolylines.map(
          (polyline) =>
            ({
              name: 'line',
              animated: animated && ['draw'],
              path: polyline
            }) satisfies FrameSettingsElement
        )
      },
      {
        type: 'g',
        style: {
          filter: styled ? 'var(--arwes-frames-deco-filter)' : undefined,
          fill: styled ? 'none' : undefined,
          stroke: styled ? 'var(--arwes-frames-deco-color, currentcolor)' : undefined,
          strokeWidth: String(smallLineWidth)
        },
        animated: animated && {
          transitions: {
            entering: ({ element, duration, animate }) =>
              animate(element, { opacity: [0, 1, 0.5, 1] }, { duration: duration / 2 }),
            exiting: ({ element, duration, animate }) =>
              animate(element, { opacity: [1, 0, 0.5, 0] }, { duration: duration / 2 })
          }
        },
        elements: smallPolylines.map(
          (polyline) => ({ name: 'deco', path: polyline }) satisfies FrameSettingsElement
        )
      }
    ]
  }
}

export type { CreateFrameLinesSettingsProps }
export { createFrameLinesSettings }
