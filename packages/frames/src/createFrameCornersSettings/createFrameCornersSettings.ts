import { filterProps } from '@arwes/tools'
import { animateDraw } from '@arwes/animated'
import type { FrameSettingsPathDefinition, FrameSettingsElement, FrameSettings } from '../types.js'

type CreateFrameCornersSettingsProps = {
  styled?: boolean
  animated?: boolean
  padding?: number
  strokeWidth?: number
  cornerLength?: number
}

const defaultProps: Required<CreateFrameCornersSettingsProps> = {
  styled: true,
  animated: true,
  padding: 0,
  strokeWidth: 1,
  cornerLength: 16
}

const createFrameCornersSettings = (props?: CreateFrameCornersSettingsProps): FrameSettings => {
  const {
    styled,
    animated,
    padding: p,
    strokeWidth: cw,
    cornerLength: cl
  } = { ...defaultProps, ...(props ? filterProps(props) : null) }

  const co = cw / 2

  const linesPaths: FrameSettingsPathDefinition[] = [
    // Left top.
    [
      ['M', co + p, co + p],
      ['L', co + p, cl + p]
    ],
    [
      ['M', co + p, co + p],
      ['L', cl + p, co + p]
    ],

    // Right top.
    [
      ['M', `100% - ${co} - ${p}`, co + p],
      ['L', `100% - ${cl} - ${p}`, co + p]
    ],
    [
      ['M', `100% - ${co} - ${p}`, co + p],
      ['L', `100% - ${co} - ${p}`, cl + p]
    ],

    // Right bottom.
    [
      ['M', `100% - ${co} - ${p}`, `100% - ${co} - ${p}`],
      ['L', `100% - ${co} - ${p}`, `100% - ${cl} - ${p}`]
    ],
    [
      ['M', `100% - ${co} - ${p}`, `100% - ${co} - ${p}`],
      ['L', `100% - ${cl} - ${p}`, `100% - ${co} - ${p}`]
    ],

    // Left bottom.
    [
      ['M', co + p, `100% - ${co} - ${p}`],
      ['L', cl + p, `100% - ${co} - ${p}`]
    ],
    [
      ['M', co + p, `100% - ${co} - ${p}`],
      ['L', co + p, `100% - ${cl} - ${p}`]
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
        x: p + cw,
        y: p + cw,
        width: `100% - ${(p + cw) * 2}`,
        height: `100% - ${(p + cw) * 2}`
      },
      {
        type: 'g',
        style: {
          filter: styled ? 'var(--arwes-frames-line-filter)' : undefined,
          fill: styled ? 'none' : undefined,
          stroke: styled ? 'var(--arwes-frames-line-color, currentcolor)' : undefined,
          strokeLinecap: styled ? 'round' : undefined,
          strokeLinejoin: styled ? 'round' : undefined,
          strokeWidth: String(cw)
        },
        elements: linesPaths.map((path) => ({
          type: 'path',
          name: 'line',
          animated: animated && {
            transitions: {
              entering: ({ element, duration }) =>
                animateDraw({ isEntering: true, element: element as SVGPathElement, duration }),
              exiting: ({ element, duration }) =>
                animateDraw({ isEntering: false, element: element as SVGPathElement, duration })
            }
          },
          path
        })) satisfies FrameSettingsElement[]
      }
    ]
  }
}

export type { CreateFrameCornersSettingsProps }
export { createFrameCornersSettings }
