'use client'

import { Link } from '@/router'
import { Codepen as IconPlay } from 'iconoir-react'

import { AR } from '@/ui'
import { Example } from './Example'

export default (): JSX.Element => (
  <>
    <AR.Header>React Animators</AR.Header>

    <AR.P>
      ARWES provides a few components and functionalities to orchestrate animations with the
      animator system. Make sure to read the{' '}
      <Link href="/docs/develop/fundamentals/motion">motion fundamentals</Link> to understand the
      animator system.
    </AR.P>

    <AR.P>
      An <code>&lt;Animator&gt;</code> component can be used to declare an animator node. It does
      not render UI elements and provides a{' '}
      <a href="https://react.dev/reference/react/createContext" target="_blank">
        React context
      </a>{' '}
      with the animator interface to all children components.
    </AR.P>

    <AR.P>As an example, we can create a card component with image, title, and description:</AR.P>

    <AR.CodeBlock
      filename="Card.tsx"
      lang="tsx"
      code={`const Card = (): JSX.Element => (
  <article className='card'>
    <img className='card-image' src='logo.svg' />
    <h1 className='card-title'>ARWES</h1>
    <p className='card-description'>Futuristic Sci-Fi UI Web Framework.</p>
  </article>
)`}
    />

    <AR.P>Which could hypothetically render something like this:</AR.P>

    <Example isDisabled />

    <AR.H2>
      <code>&lt;Animator&gt;</code>
    </AR.H2>

    <AR.P>
      Generally, an UI component can have one animator to manage its animations but if more complex
      animations are required, multiple animators can be used for different pieces of the component
      internally. For the card component, there can be a parent animator and children animators for
      every element:
    </AR.P>

    <AR.CodeBlock
      filename="Card.tsx"
      lang="tsx"
      highlightLines={[4, 6, 9, 12]}
      code={`import { Animator } from '@arwes/react'

const Card = (): JSX.Element => (
  <Animator>
    <article className='card'>
      <Animator>
        <img className='card-image' src='logo.svg' />
      </Animator>
      <Animator>
        <h1 className='card-title'>ARWES</h1>
      </Animator>
      <Animator>
        <p className='card-description'>Futuristic Sci-Fi UI Web Framework.</p>
      </Animator>
    </article>
  </Animator>
)`}
    />

    <AR.H2>
      <code>&lt;Animated&gt;</code>
    </AR.H2>

    <AR.P>
      By itself, it does not do anything but it is complemented by the <code>&lt;Animated&gt;</code>{' '}
      component to run animations. It will listen to the closest parent animator node to run
      animations on every state change. If the animator is disabled or there is no animator
      available, all its animation definitions will be ignored.
    </AR.P>

    <AR.CodeBlock
      filename="Card.tsx"
      lang="tsx"
      highlightLines={[5, 7, 10, 13]}
      code={`import { Animator, Animated } from '@arwes/react'

const Card = (): JSX.Element => (
  <Animator>
    <Animated as='article' className='card'>
      <Animator>
        <Animated as='img' className='card-image' src='logo.svg' />
      </Animator>
      <Animator>
        <Animated as='h1' className='card-title'>ARWES</Animated>
      </Animator>
      <Animator>
        <Animated as='p' className='card-description'>
          Futuristic Sci-Fi UI Web Framework.
        </Animated>
      </Animator>
    </Animated>
  </Animator>
)`}
    />

    <AR.P>The card can have the following transition animations:</AR.P>

    <AR.UL>
      <li>The card container can have a fading transition.</li>
      <li>The image can have a rotation and flickering transition.</li>
      <li>
        The title and the description can have a right-to-left translation and fading transition.
      </li>
    </AR.UL>

    <AR.CodeBlock
      filename="Card.tsx"
      lang="tsx"
      highlightLines={[5, 11, 19, 28]}
      code={`<Animator>
  <Animated
    as='article'
    className='card'
    animated={['fade']}
  >
    <Animator>
      <Animated
        as='img'
        className='card-image'
        animated={['flicker', ['rotate', -45, 0]]}
        src='logo.svg'
      />
    </Animator>
    <Animator>
      <Animated
        as='h1'
        className='card-title'
        animated={['fade', ['x', 20, 0]]}
      >
        ARWES
      </Animated>
    </Animator>
    <Animator>
      <Animated
        as='p'
        className='card-description'
        animated={['fade', ['x', 20, 0]]}
      >
        Futuristic Sci-Fi UI Web Framework.
      </Animated>
    </Animator>
  </Animated>
</Animator>`}
    />

    <AR.P>
      Which would run the following animations when the parent animator node has enter and exit
      transitions:
    </AR.P>

    <Example />

    <AR.H2>Animations</AR.H2>

    <AR.P>
      <code>&lt;Animated&gt;</code> provides a few built-in transitions such as <code>fade</code>{' '}
      and <code>flicker</code> for simplicity.
    </AR.P>

    <AR.P>
      Any custom transition animation can be defined with a shorthand array like{' '}
      <code>[cssProperty, fromValue, toValue]</code> which will run the animation for entering and
      exiting animator node transitions.
    </AR.P>

    <AR.P>
      But there are more ways to define animations such as with objects or functions for more
      complex use cases.
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      code={`{/* Shorthand array definition: */}
<Animated animated={[['opacity', 0, 1]]} />

{/* Is the same with object definition: */}
<Animated animated={{
  transitions: {
    entering: { opacity: [0, 1] },
    exiting: { opacity: [1, 0] }
  }
}} />

{/* Is the same with custom functions (using Motion One library): */}
import { animate } from 'motion'
<Animated animated={{
  transitions: {
    entering: ({ element, duration }) =>
      animate(element, { opacity: [0, 1] }, { duration }),
    exiting: ({ element, duration }) =>
      animate(element, { opacity: [1, 0] }, { duration })
  }
}} />`}
    />

    <AR.P>
      For most cases, the <code>entering</code> and <code>exiting</code> state animations are enough
      but the <code>exited</code> and <code>entered</code> states can be used also.
    </AR.P>

    <AR.P>
      By default, <code>&lt;Animated&gt;</code> will be hidden with CSS{' '}
      <code>visibility: hidden</code> when the corresponding animator is in <code>exited</code>{' '}
      state, unless configured otherwise.
    </AR.P>

    <AR.P>
      <code>&lt;Animated&gt;</code> animations will get their durations from their parent{' '}
      <code>&lt;Animator&gt;</code> node but they can be overwriten. There are also other settings
      which can be configured in both components. Keep in mind that all durations are defined in
      seconds.
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      code={`import { spring } from 'motion'

{/* Defining durations and timings in <Animator>. */}
<Animator duration={{ enter: 0.7, exit: 0.3, delay: 0.25 }}>
  <Animated animated={[['opacity', 0, 1, undefined, spring()]]} />
</Animator>

{/* Or */}

{/* Defining durations and timings in <Animated>. */}
<Animator>
  <Animated animated={{
    transitions: {
      entering: { opacity: [0, 1], duration: 0.7, delay: 0.25, easing: spring() },
      exiting: { opacity: [1, 0], duration: 0.3, easing: spring() }
    }
  }} />
</Animator>`}
    />

    <AR.P>In the card component, the make the animations smoother and sleeker:</AR.P>

    <AR.UL>
      <li>
        The entire card container can be animated for the entire duration of the card transition.
        This can be achieved by making the main <code>&lt;Animator&gt;</code> a combination of its
        children animators with <code>combine</code> prop. The{' '}
        <code>&lt;Animated as="article"&gt;</code> element will now have the entire duration
        dynamically calculated automatically.
      </li>
      <li>
        Then each element inside could be animated in staggering order for a better look and feel.
        Since the main animator is the parent of all three children animators, it can be configured
        with a <code>manager="stagger"</code> prop.
      </li>
      <li>
        And we can have the staggering interval duration slower and the image transition slower from
        the default settings with custom durations.
      </li>
    </AR.UL>

    <AR.CodeBlock
      filename="Card.tsx"
      lang="tsx"
      highlightLines={[1, 7]}
      code={`<Animator combine manager="stagger" duration={{ stagger: 0.1 }}>
  <Animated
    as='article'
    className='card'
    animated={['fade']}
  >
    <Animator duration={{ enter: 0.8 }}>
      <Animated
        as='img'
        className='card-image'
        animated={['flicker', ['rotate', -45, 0]]}
        src='logo.svg'
      />
    </Animator>
    {/* ... */}
  </Animated>
</Animator>`}
    />

    <Example isPolished />

    <AR.H2>
      <code>&lt;AnimatorGeneralProvider&gt;</code>
    </AR.H2>

    <AR.P>
      All <code>&lt;Animator&gt;</code> components in a tree can have default settings customized
      using the <code>&lt;AnimatorGeneralProvider&gt;</code> component. It can be used mostly to
      enable/disable animators and setup default durations.
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      code={`import { AnimatorGeneralProvider } from '@arwes/react'

<AnimatorGeneralProvider
  disabled={false}
  duration={{ enter: 0.4, exit: 0.4, stagger: 0.04 }}
>
  <Animator>
    {/* ... */}
  </Animator>
</AnimatorGeneralProvider>`}
    />

    <AR.H2>Simplification</AR.H2>

    <AR.P>
      The card component animations can be roughly simplified by just using one animator and running
      just one animation since the of UI elements are known and controlled.
    </AR.P>

    <AR.CodeBlock
      filename="Card.tsx"
      lang="tsx"
      code={`import { Animator, Animated, type AnimatedProp } from '@arwes/react'
import { timeline, stagger } from 'motion'

const animated: AnimatedProp = {
  transitions: {
    entering: ({ element, $, duration }) =>
      timeline([
        [element, { opacity: [0, 1] }, { duration }],
        [
          $('img'),
          { opacity: [0, 1, 0.5, 1], rotate: [-45, 0] },
          { at: 0, duration: duration * 0.75 }
        ],
        [
          $('h1, p'),
          { opacity: [0, 1], x: [20, 0] },
          { at: 0.1, duration: duration - 0.2, delay: stagger(0.1) }
        ]
      ]),
    // The exit transition animation is simplified by just
    // animating the root element.
    exiting: { opacity: [1, 0, 0.5, 0] }
  }
}

const Card = (): JSX.Element => (
  <Animator>
    <Animated
      as='article'
      className='card'
      animated={animated}
    >
      <img className='card-image' src='logo.svg' />
      <h1 className='card-title'>ARWES</h1>
      <p className='card-description'>Futuristic Sci-Fi UI Web Framework.</p>
    </Animated>
  </Animator>
)`}
    />

    <AR.P>
      This approach restricts the flexibility because animations are hard-coded. But in isolated
      components it can be a performance improvement. This depends on the use case and performance
      constraints.
    </AR.P>

    <AR.H2>Animation Tools</AR.H2>

    <AR.P>
      Integrating any other animation tool is fairly easy to do. An example with{' '}
      <a href="https://gsap.com" target="_blank">
        GSAP
      </a>{' '}
      could be:
    </AR.P>

    <AR.CodeBlock
      lang="tsx"
      code={`import { gsap } from 'gsap'

<Animated animated={{
  transitions: {
    entering: ({ element, duration }) =>
      gsap.to(element, { opacity: 1, duration }),
    exiting: ({ element, duration }) =>
      gsap.to(element, { opacity: 0, duration })
  }
}} />`}
    />

    <AR.P>
      The only requirement is that the return of the transition animation function is an object
      which contains a <code>.cancel()</code> method to cancel the animation and remove all animated
      properties on the element(s). Optionally, it can provide a <code>.then(callback)</code> method
      or <code>.finished</code> promise to know when the animation is finished for performance
      reasons.
    </AR.P>

    <AR.H2>Composition</AR.H2>

    <AR.P>
      Once a UI component has configured its animators and animated components, it can be reused
      anywhere along with other animators to orchestrate when and how the animations should run.
    </AR.P>

    <AR.P>
      Check out the{' '}
      <a href="/play">
        <IconPlay /> Playground
      </a>{' '}
      for more examples.
    </AR.P>

    <AR.Navigation
      prevHref="/docs/develop/react"
      prev="React"
      nextHref="/docs/develop/react/bleeps"
      next="Bleeps"
    />
  </>
)
