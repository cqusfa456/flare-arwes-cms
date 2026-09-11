'use client'

import { Link } from '@/router'
import { Animated, Animator } from '@arwes/react'
import { Codepen as IconPlay } from 'iconoir-react'

import { AR } from '@/ui'
import { IconReact } from '@/icons'

export default (): JSX.Element => (
  <>
    <AR.Header>Vanilla</AR.Header>

    <Animator>
      <Animated className="flex flex-row gap-2" animated={['flicker']}>
        <img
          className="!m-0"
          alt="bundle size"
          src="https://img.shields.io/bundlephobia/minzip/arwes.svg"
        />
        <img
          className="!m-0"
          alt="installs"
          src="https://img.shields.io/npm/dm/arwes?label=installs&style=flat-square"
        />
      </Animated>
    </Animator>

    <AR.P>
      Vanilla packages are the core of the framework. They do not have major external dependencies
      but most tools are low level APIs and sometimes require elaborated setups/configurations. Many
      of these APIs are simplified using the other implementation packages such as{' '}
      <Link href="/docs/develop/react">
        <IconReact /> React
      </Link>
      .
    </AR.P>

    <AR.H2>Get Started</AR.H2>

    <AR.P>Install the package:</AR.P>

    <AR.CodeBlock lang="bash" code="npm install arwes" />

    <AR.P>
      Check out the{' '}
      <a href="/play">
        <IconPlay /> Playground
      </a>{' '}
      for examples on how to use the vanilla functionalities.
    </AR.P>

    <AR.H2>Packages</AR.H2>

    <AR.P>These are the available vanilla packages:</AR.P>

    <AR.Table>
      <AR.Row className="grid grid-cols-[10rem_1fr] lg:grid-cols-[15rem_1fr]">
        <AR.Cell isHeader>Package</AR.Cell>
        <AR.Cell isHeader>Description</AR.Cell>
      </AR.Row>
      {[
        { name: '@arwes/tools', description: 'General browser utilities' },
        { name: '@arwes/theme', description: 'Visual themes scaffolding' },
        { name: '@arwes/styles', description: 'Special visual styles' },
        { name: '@arwes/animator', description: 'Interfaces assembling' },
        { name: '@arwes/animated', description: 'Animation sequences effects' },
        { name: '@arwes/bleeps', description: 'Short sounds management' },
        { name: '@arwes/text', description: 'Text rendering effects' },
        { name: '@arwes/frames', description: 'Responsive scalable vector graphics' },
        { name: '@arwes/bgs', description: 'Passive background ambiences' },
        { name: '@arwes/effects', description: 'Special effects' },
        { name: '@arwes/core', description: 'Integration functionalities' },
        { name: 'arwes', description: 'All vanilla packages bundle' }
      ].map(({ name, description }) => (
        <AR.Row key={name} className="grid grid-cols-[10rem_1fr] lg:grid-cols-[15rem_1fr]">
          <AR.Cell>
            <code>{name}</code>
          </AR.Cell>
          <AR.Cell>{description}</AR.Cell>
        </AR.Row>
      ))}
    </AR.Table>

    <AR.Navigation prevHref="/docs/develop" prev="Develop" />
  </>
)
