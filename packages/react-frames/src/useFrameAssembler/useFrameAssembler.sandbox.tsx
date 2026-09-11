import React, { type ReactElement, useRef, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { FrameLines, useFrameAssembler } from '@arwes/react-frames'

const Frame = (): ReactElement => {
  const elementRef = useRef<SVGSVGElement>(null)
  useFrameAssembler(elementRef)
  return (
    <FrameLines
      elementRef={elementRef}
      style={{
        // @ts-expect-error css variables
        '--arwes-frames-bg-color': 'hsl(60, 75%, 10%)',
        '--arwes-frames-bg-filter': 'drop-shadow(0 0 2px hsl(60, 75%, 10%))',
        '--arwes-frames-line-color': 'hsl(60, 75%, 25%)',
        '--arwes-frames-line-filter': 'drop-shadow(0 0 2px hsl(60, 75%, 25%))',
        '--arwes-frames-deco-color': 'hsl(60, 75%, 50%)',
        '--arwes-frames-deco-filter': 'drop-shadow(0 0 2px hsl(60, 75%, 50%))'
      }}
      animated={false} // Built-in animations must be disabled.
      padding={4}
    />
  )
}

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 3_000 : 1_500)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator active={active} duration={{ enter: 1, exit: 1 }}>
      <div style={{ position: 'relative', width: 300, height: 200 }}>
        <Frame />
      </div>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
