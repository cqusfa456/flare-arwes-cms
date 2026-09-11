import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Text } from '@arwes/react-text'

const Sandbox = (): ReactElement => {
  return (
    <Animator duration={{ enter: 5 }}>
      <Text style={{ color: '#0ff', fontFamily: 'Tomorrow' }} blink blinkDuration={0.5} fixed>
        Futuristic Sci-Fi UI Web Framework.
      </Text>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
