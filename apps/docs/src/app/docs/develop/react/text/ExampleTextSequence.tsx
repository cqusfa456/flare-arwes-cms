'use client'

import { useEffect, useState } from 'react'
import { Animated, Animator, AnimatorGeneralProvider, Text } from '@arwes/react'

const Example = (): JSX.Element => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 5_000 : 1_500)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false} duration={{ enter: 2, exit: 1 }}>
      <Animator root active={active}>
        <Animated
          className="flex flex-col gap-2 px-8 py-2 bg-primary-main-7/10"
          hideOnExited={false}
        >
          <Text as="div" className="!m-0 text-pretty prose-a:transition-none" fixed>
            <h3>Nebula</h3>

            <p>
              A <b>nebula</b> (
              <a target="_blank" href="/wiki/Latin_language">
                Latin
              </a>{' '}
              for 'cloud, fog'; <abbr>pl.</abbr>: <b>nebulae</b>, <b>nebulæ</b>, or <b>nebulas</b>)
              is a distinct luminescent part of{' '}
              <a target="_blank" href="/wiki/Interstellar_medium">
                interstellar medium
              </a>
              , which can consist of ionized, neutral, or molecular{' '}
              <a target="_blank" href="/wiki/Hydrogen">
                hydrogen
              </a>{' '}
              and also{' '}
              <a target="_blank" href="/wiki/Cosmic_dust">
                cosmic dust
              </a>
              .
            </p>

            <p>
              Nebulae are often star-forming regions, such as in the{' '}
              <a target="_blank" href="/wiki/Pillars_of_Creation">
                Pillars of Creation
              </a>{' '}
              in the{' '}
              <a target="_blank" href="/wiki/Eagle_Nebula">
                Eagle Nebula
              </a>
              .
            </p>

            <p>
              In these regions, the formations of gas, dust, and other materials "clump" together to
              form denser regions, which attract further matter and eventually become dense enough
              to form{' '}
              <a target="_blank" href="/wiki/Star">
                stars
              </a>
              .
            </p>

            <p>
              The remaining material is then thought to form{' '}
              <a target="_blank" href="/wiki/Planet">
                planets
              </a>{' '}
              and other{' '}
              <a target="_blank" href="/wiki/Planetary_system">
                planetary system
              </a>{' '}
              objects.
            </p>
          </Text>
        </Animated>
      </Animator>
    </AnimatorGeneralProvider>
  )
}

const ExampleTextSequence = (): JSX.Element => {
  return (
    <Animator unmountOnExited>
      <Animated data-name="example">
        <Example />
      </Animated>
    </Animator>
  )
}

export { ExampleTextSequence }
