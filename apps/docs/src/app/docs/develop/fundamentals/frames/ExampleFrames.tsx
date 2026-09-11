'use client'

import { useEffect, useState } from 'react'
import {
  Animated,
  Animator,
  AnimatorGeneralProvider,
  FrameUnderline,
  FrameOctagon,
  FrameCorners,
  FrameLines,
  FrameNefrex,
  FrameKranox,
  FrameNero,
  FrameCircle,
  FrameHeader
} from '@arwes/react'
import { theme } from '@/config'

const Frames = (): JSX.Element => {
  return (
    <div
      className="flex flex-row flex-wrap gap-4"
      style={{
        // @ts-expect-error css variables
        '--arwes-frames-bg-color': theme.colors.secondary.main(10),
        '--arwes-frames-bg-stroke': theme.colors.secondary.main(8),
        '--arwes-frames-bg-filter': `drop-shadow(0 0 2px ${theme.colors.secondary.main(8)})`,
        '--arwes-frames-line-color': theme.colors.secondary.main(6),
        '--arwes-frames-line-filter': `drop-shadow(0 0 2px ${theme.colors.secondary.main(6)})`,
        '--arwes-frames-deco-color': theme.colors.secondary.main(3),
        '--arwes-frames-deco-filter': `drop-shadow(0 0 2px ${theme.colors.secondary.main(3)})`
      }}
    >
      <FrameUnderline
        className="!relative !inset-auto !w-36 !h-32 md:!w-48"
        padding={4}
        strokeWidth={2}
        squareSize={20}
      />
      <FrameOctagon
        className="!relative !inset-auto !w-36 !h-32 md:!w-48"
        padding={4}
        strokeWidth={2}
        squareSize={20}
      />
      <FrameCorners
        className="!relative !inset-auto !w-36 !h-32 md:!w-48"
        padding={4}
        cornerLength={20}
        strokeWidth={2}
      />
      <FrameLines
        className="!relative !inset-auto !w-36 !h-32 md:!w-48"
        padding={4}
        largeLineWidth={2}
        smallLineWidth={2}
        smallLineLength={20}
      />
      <FrameKranox
        className="!relative !inset-auto !w-36 !h-32 md:!w-48"
        padding={4}
        strokeWidth={2}
        squareSize={10}
        smallLineLength={10}
        largeLineLength={20}
      />
      <FrameNefrex
        className="!relative !inset-auto !w-36 !h-32 md:!w-48"
        padding={4}
        strokeWidth={2}
        squareSize={20}
        smallLineLength={20}
        largeLineLength={40}
      />
      <FrameNero className="!relative !inset-auto !w-36 !h-32 md:!w-48" padding={4} />
      <FrameCircle className="!relative !inset-auto !w-32 !h-32 md:!w-36 md:!h-36" padding={4} />
      <FrameHeader
        className="!relative !inset-auto !w-36 !h-12 md:!w-48"
        padding={4}
        contentLength={theme.spacen(14)}
      />
    </div>
  )
}

const Example = (): JSX.Element => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 2_500 : 1_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 1, exit: 0.5 }}>
      <Animator root active={active}>
        <Frames />
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleFrames = (): JSX.Element => {
  return (
    <Animator unmountOnExited>
      <Animated data-name="example">
        <Example />
      </Animated>
    </Animator>
  )
}

export { ExampleFrames }
