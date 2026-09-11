'use client'

import { Link } from '@/router'
import { Codepen as IconPlay } from 'iconoir-react'

import { AR } from '@/ui'
import { ExampleButton } from './ExampleButton'
import { ExampleOnAnimator } from './ExampleOnAnimator'

export default (): JSX.Element => (
  <>
    <AR.Header>React Bleeps</AR.Header>

    <AR.P>
      ARWES provides the Bleeps API to manage short sound effects in an app. Make sure to read the{' '}
      <Link href="/docs/develop/fundamentals/audio">audio fundamentals</Link> for context.
    </AR.P>

    <AR.H2>Type Safety</AR.H2>

    <AR.P>To constraint the names of the bleeps to use for an app, an union type can be used:</AR.P>

    <AR.CodeBlock
      filename="types.ts"
      lang="tsx"
      code={`// List of sound names for type safety.
export type BleepsNames = 'hover' | 'type' | 'click' | 'error'`}
    />

    <AR.H2>Bleeps Provider</AR.H2>

    <AR.P>
      For most apps, creating an audio configuration and providing it to all components is
      sufficient.
    </AR.P>

    <AR.CodeBlock
      filename="App.tsx"
      lang="tsx"
      code={`import { type BleepsProviderSettings, BleepsProvider } from '@arwes/react'

// Import the previous bleeps names type.
import type { BleepsNames } from './types.ts'

const bleepsSettings: BleepsProviderSettings<BleepsNames> = {
  master: {
    volume: 0.5 // 50% of operating system volume.
  },
  common: {
    disabled: false
  },
  categories: { // Relative to the \`master\` settings.
    background: { volume: 0.25 },
    transition: { volume: 0.5 },
    interaction: { volume: 0.75 },
    notification: { volume: 1 }
  },
  bleeps: {
    hover: {
      category: 'background',
      // List of sound assets by priority for compatibility.
      sources: [
        { src: '/sounds/hover.webm', type: 'audio/webm' },
        { src: '/sounds/hover.mp3', type: 'audio/mpeg' }
      ]
    },
    type: {
      category: 'transition',
      sources: [
        { src: '/sounds/type.webm', type: 'audio/webm' },
        { src: '/sounds/type.mp3', type: 'audio/mpeg' }
      ],
      loop: true
    },
    click: {
      category: 'interaction',
      sources: [
        { src: '/sounds/click.webm', type: 'audio/webm' },
        { src: '/sounds/click.mp3', type: 'audio/mpeg' }
      ]
    },
    error: {
      category: 'notification',
      sources: [
        { src: '/sounds/error.webm', type: 'audio/webm' },
        { src: '/sounds/error.mp3', type: 'audio/mpeg' }
      ]
    }
  }
}

const App = (): JSX.Element => (
  <BleepsProvider {...bleepsSettings}>
    {/* ... */}
  </BleepsProvider>
)`}
    />

    <AR.H2>Bleeps Consumers</AR.H2>

    <AR.P>Once bleeps are provided to components, they can play them.</AR.P>

    <AR.CodeBlock
      filename="Button.tsx"
      lang="tsx"
      code={`import { useBleeps } from '@arwes/react'
import type { BleepsNames } from './types.ts'

const Button = (): JSX.Element => {
  const bleeps = useBleeps<BleepsNames>()
  return (
    <button
      onMouseEnter={() => {
        // In case the bleeps are disabled, always check if they are provided.
        bleeps.hover?.play()
      }}
      onClick={() => {
        bleeps.click?.play()
      }}
    >
      Hover or click me!
    </button>
  )
}`}
    />

    <ExampleButton />

    <AR.H2>
      <code>&lt;BleepsOnAnimator&gt;</code>
    </AR.H2>

    <AR.P>Bleeps can play declaratively on an animator state change.</AR.P>

    <AR.CodeBlock
      filename="Content.tsx"
      lang="tsx"
      code={`import { Animator, Text, BleepsOnAnimator } from '@arwes/react'
import type { BleepsNames } from './types.ts'

const Content = (): JSX.Element => (
  <Animator>
    <BleepsOnAnimator<BleepsNames>
      transitions={{ entering: 'type', exiting: 'type' }}
    />
    <Text>
      The bleep will play on the animator state changes to enter and exit.
    </Text>
  </Animator>
)`}
    />

    <ExampleOnAnimator />

    <AR.P>
      <code>continuous=&#123;true&#125;</code> prop can be used to play bleeps even after the state
      specified changes. For non-loop bleeps which have longer audio durations than the animator
      state change duration.
    </AR.P>

    <AR.P>
      Check out the{' '}
      <a href="/play">
        <IconPlay /> Playground
      </a>{' '}
      for more examples.
    </AR.P>

    <AR.Navigation
      prevHref="/docs/develop/react/animators"
      prev="Animators"
      nextHref="/docs/develop/react/text"
      next="Text"
    />
  </>
)
