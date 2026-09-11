'use client'

import { Link } from '@/router'
import { Codepen as IconPlay } from 'iconoir-react'

import { AR } from '@/ui'
import { ExampleTextSequence } from './ExampleTextSequence'
import { ExampleTextDecipher } from './ExampleTextDecipher'

export default (): JSX.Element => (
  <>
    <AR.Header>React Text</AR.Header>

    <AR.P>
      ARWES provides a few text rendering animation effects. Make sure to read the{' '}
      <Link href="/docs/develop/fundamentals/text">Text Fundamentals</Link> for context.
    </AR.P>

    <AR.H2>
      <code>&lt;Text&gt;</code>
    </AR.H2>

    <AR.P>
      The <code>&lt;Text&gt;</code> component can be used to animate simple strings to complex
      nested HTML elements. It uses the{' '}
      <Link href="/docs/develop/react/animators">
        <code>&lt;Animator&gt;</code>
      </Link>{' '}
      component to control the animation flow. If no animator is found, the content is rendered
      without effects.
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      code={`import { Animator, Text } from '@arwes/react'

<Animator>
  <Text>
    Text content.
  </Text>
</Animator>`}
    />

    <AR.P>
      By default, it will dynamically update the parent animator duration settings to match the
      length of the text content, unless configured with the prop{' '}
      <code>fixed=&#123;true&#125;</code> to use the already provided duration by the animator.
    </AR.P>

    <AR.H2>Sequence</AR.H2>

    <AR.P>
      It can have "manager" effect, the default is <code>'sequence'</code> which renders character
      by character forward-to-backward on animator state changes.
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      code={`import { Animator, Text } from '@arwes/react'

// By default, the duration provided by the animator will be the maximum based on
// the dynamic calculation of the text length.
<Animator duration={{ enter: 2 }}>
  <Text
    as='div' // 'p' by default
    // manager='sequence'
    // Since it has an internal HTML element, pass the 'style: CSSProperties' to it.
    contentStyle={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    // It also accepts 'contentClassName: string'.
  >
    <h3>Nebula</h3>
    <p>A <b>nebula</b> (<a href="/wiki/Latin_language">Latin</a> for 'cloud, fog'; ...</p>
    <p>Nebulae are often star-forming regions, such as in the ...</p>
    <p>In these regions, the formations of gas, dust, and other materials "clump" together to ...</p>
    <p>The remaining material is then thought to form <a href="/wiki/Planet">planets</a> ...</p>
  </Text>
</Animator>`}
    />

    <ExampleTextSequence />

    <AR.P>
      If the blinking sub-effect is used, the end of line blinking character, there should not be{' '}
      <code>&lt;br&gt;</code> elements since it will disturb the animation.
    </AR.P>

    <AR.H2>Dechiper</AR.H2>

    <AR.P>
      The manager <code>'decipher'</code> can be used to decrypt and encrypt the text content on
      animator state change. This type of animation is recommended for short, or centered, or
      monospace typograhy texts.
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      highlightLines={[7]}
      code={`import { Animator, Text } from '@arwes/react'

<Animator duration={{ enter: 1, exit: 1 }}>
  <Text className='text-decipher' manager='decipher' fixed>
    Pillars of Creation
  </Text>
</Animator>`}
    />

    <ExampleTextDecipher />

    <AR.P>
      Check out the{' '}
      <a href="/play">
        <IconPlay /> Playground
      </a>{' '}
      for more examples.
    </AR.P>

    <AR.Navigation
      prevHref="/docs/develop/react/bleeps"
      prev="Bleeps"
      nextHref="/docs/develop/react/frames"
      next="Frames"
    />
  </>
)
