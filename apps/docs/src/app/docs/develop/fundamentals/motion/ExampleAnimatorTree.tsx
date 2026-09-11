'use client'

import { useEffect, useState } from 'react'
import { AnimatorGeneralProvider, Animator, Animated, useAnimator } from '@arwes/react'

import { theme } from '@/config'

const ExampleNodeTextState = (): JSX.Element => {
  const animator = useAnimator()!
  const [state, setState] = useState('')

  useEffect(() => animator.node.subscribe((node) => setState(node.state)), [])

  return <>{state}</>
}

const ExampleNodeText = (props: { x: string; y: string }): JSX.Element => {
  const { x, y } = props
  return (
    <Animated<SVGTextElement>
      as="text"
      className="stroke-neutral-1"
      style={{ font: 'var(--app-font-body) 300 16px' }}
      hideOnExited={false}
      x={x}
      y={y}
    >
      <ExampleNodeTextState />
    </Animated>
  )
}

const ExampleNodeBg = (props: { x: string; y: string }): JSX.Element => {
  const { x, y } = props
  return (
    <Animated<SVGRectElement>
      as="rect"
      className="fill-primary-main-10 stroke-primary-main-8"
      x={x}
      y={y}
      width="100"
      height="50"
      stroke="1"
      animated={[
        [
          'fill',
          theme.colors.primary.main(10),
          theme.colors.secondary.main(8),
          undefined,
          'linear'
        ],
        [
          'stroke',
          theme.colors.primary.main(8),
          theme.colors.secondary.main(6),
          undefined,
          'linear'
        ]
      ]}
      hideOnExited={false}
    />
  )
}

type ExampleProps = { inSequence?: boolean; hasCombinations?: boolean }

const Example = (props: ExampleProps): JSX.Element => {
  const { inSequence, hasCombinations } = props

  const [active, setActive] = useState(false)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 6_000 : 2_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 1, exit: 1 }}>
      <Animator root active={active} combine>
        <svg
          className="w-[500px] max-w-full"
          viewBox="0 0 500 250"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path className="stroke-neutral-3" d="M249.5 45L111.5 103.5" strokeWidth="2" />
          <path className="stroke-neutral-3" d="M251 47L390 104.5" strokeWidth="2" />
          <path className="stroke-neutral-3" d="M112.5 143.5L36.5 206" strokeWidth="2" />
          <path className="stroke-neutral-3" d="M113.5 145.5L183.5 206.5" strokeWidth="2" />
          <path className="stroke-neutral-3" d="M382.5 143.5L306.5 206" strokeWidth="2" />
          <path className="stroke-neutral-3" d="M383.5 145.5L455 205" strokeWidth="2" />

          <Animator
            combine={hasCombinations}
            manager={inSequence || hasCombinations ? 'sequence' : 'parallel'}
          >
            <ExampleNodeBg x="200" y="0" />
            <ExampleNodeText x="220" y="30" />

            <Animator
              combine={hasCombinations}
              manager={inSequence || hasCombinations ? 'sequence' : 'parallel'}
            >
              <ExampleNodeBg x="65" y="100" />
              <ExampleNodeText x="85" y="130" />

              <Animator manager={inSequence ? 'sequence' : 'parallel'}>
                <ExampleNodeBg x="0" y="200" />
                <ExampleNodeText x="20" y="230" />
              </Animator>

              <Animator manager={inSequence ? 'sequence' : 'parallel'}>
                <ExampleNodeBg x="130" y="200" />
                <ExampleNodeText x="150" y="230" />
              </Animator>
            </Animator>

            <Animator
              combine={hasCombinations}
              manager={inSequence || hasCombinations ? 'sequence' : 'parallel'}
            >
              <ExampleNodeBg x="335" y="100" />
              <ExampleNodeText x="355" y="130" />

              <Animator manager={inSequence ? 'sequence' : 'parallel'}>
                <ExampleNodeBg x="270" y="200" />
                <ExampleNodeText x="290" y="230" />
              </Animator>

              <Animator manager={inSequence ? 'sequence' : 'parallel'}>
                <ExampleNodeBg x="400" y="200" />
                <ExampleNodeText x="420" y="230" />
              </Animator>
            </Animator>
          </Animator>
        </svg>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleAnimatorTree = (props: ExampleProps): JSX.Element => (
  <Animator unmountOnExited>
    <Animated data-name="example">
      <Example {...props} />
    </Animated>
  </Animator>
)

export { ExampleAnimatorTree }
