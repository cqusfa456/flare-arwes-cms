'use client'

import { Link } from '@/router'
import { Codepen as IconPlay } from 'iconoir-react'

import { AR } from '@/ui'
import { ExampleBg } from './ExampleBg'

export default (): JSX.Element => (
  <>
    <AR.Header>React Backgrounds</AR.Header>

    <AR.P>
      ARWES provides a few ambient background components. Make sure to read the{' '}
      <Link href="/docs/develop/fundamentals/bgs">Backgrounds Fundamentals</Link> for context.
    </AR.P>

    <AR.P>
      By default, they will have CSS <code>position: absolute</code> to occupy the closest parent
      positioned element. Other elements which should be on top of the background should be
      positioned also. This is to allow simple dynamic resizing on the content to display or simply
      to occupy the entire window viewport.
    </AR.P>

    <AR.P>
      They work with the{' '}
      <Link href="/docs/develop/react/animators">
        <code>&lt;Animator&gt;</code>
      </Link>{' '}
      component to manage the animation flow. If no animator is found, the background is rendered as
      a static image.
    </AR.P>

    <AR.CodeBlock
      code={`import { Animator, Puffs } from '@arwes/react'

<Animator duration={{ enter: 1 }}>
  <Puffs
    color="hsl(60, 75%, 50%, 0.5)"
    quantity={100}
    padding={0}
    xOffset={[10, 50]}
    yOffset={[-20, -80]}
    radiusOffset={[4, 20]}
  />
  <div style={{ position: 'relative' }}>
    <h1>ARWES</h1>
  </div>
</Animator>`}
    />

    <ExampleBg />

    <AR.P>
      Check out the{' '}
      <a href="/play">
        <IconPlay /> Playground
      </a>{' '}
      for more examples.
    </AR.P>

    <AR.Navigation
      prevHref="/docs/develop/react/frames"
      prev="Frames"
      nextHref="/docs/develop/react"
      next="React"
    />
  </>
)
