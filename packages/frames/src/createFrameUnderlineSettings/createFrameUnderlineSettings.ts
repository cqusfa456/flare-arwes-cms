import { filterProps } from '@arwes/tools'
import { animateDraw } from '@arwes/animated'
import type { FrameSettings } from '../types.js'

type CreateFrameUnderlineSettingsProps = {
  styled?: boolean
  animated?: boolean
  padding?: number
  squareSize?: number
  strokeWidth?: number
}

const defaultProps: Required<CreateFrameUnderlineSettingsProps> = {
  styled: true,
  animated: true,
  padding: 0,
  squareSize: 16,
  strokeWidth: 1
}

const createFrameUnderlineSettings = (props?: CreateFrameUnderlineSettingsProps): FrameSettings => {
  const {
    styled,
    animated,
    squareSize: ss,
    strokeWidth: sw,
    padding: p
  } = { ...defaultProps, ...(props ? filterProps(props) : null) }

  const so = sw / 2

  return {
    elements: [
      {
        name: 'bg',
        style: {
          filter: styled ? 'var(--arwes-frames-bg-filter)' : undefined,
          fill: styled ? 'var(--arwes-frames-bg-color, currentcolor)' : undefined,
          strokeWidth: 0
        },
        animated: animated && ['fade'],
        path: [
          ['M', p, p],
          ['L', p, `100% - ${p}`],
          ['L', `100% - ${ss} - ${p}`, `100% - ${p}`],
          ['L', `100% - ${p}`, `100% - ${ss} - ${p}`],
          ['L', `100% - ${p}`, p]
        ]
      },
      {
        name: 'line',
        style: {
          filter: styled ? 'var(--arwes-frames-line-filter)' : undefined,
          fill: styled ? 'none' : undefined,
          stroke: styled ? 'var(--arwes-frames-line-color, currentcolor)' : undefined,
          strokeLinecap: styled ? 'round' : undefined,
          strokeLinejoin: styled ? 'round' : undefined,
          strokeWidth: String(sw)
        },
        animated: animated && {
          transitions: {
            entering: ({ element, duration }) =>
              animateDraw({ isEntering: true, element: element as SVGPathElement, duration }),
            exiting: ({ element, duration }) =>
              animateDraw({ isEntering: false, element: element as SVGPathElement, duration })
          }
        },
        path: [
          ['M', so + p, `100% - ${so} - ${p}`],
          ['L', `100% - ${ss} - ${p}`, `100% - ${so} - ${p}`],
          ['L', `100% - ${so} - ${p}`, `100% - ${ss - so} - ${p}`]
        ]
      }
    ]
  }
}

export type { CreateFrameUnderlineSettingsProps }
export { createFrameUnderlineSettings }
