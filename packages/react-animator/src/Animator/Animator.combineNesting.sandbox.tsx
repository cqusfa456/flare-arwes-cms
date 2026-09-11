import React, { type ReactNode, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { type AnimatorProps, Animator, AnimatorGeneralProvider } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

interface ItemProps extends AnimatorProps {
  children?: ReactNode
}

const Item = ({ children, ...animator }: ItemProps): ReactElement => {
  return (
    <Animator {...animator}>
      <Animated
        style={{ margin: 5, width: 40, height: 6, background: '#777' }}
        animated={{
          transitions: {
            entering: {
              x: [0, 100],
              background: ['#0ff', '#ff0'],
              easing: 'linear'
            }
          }
        }}
        hideOnExited={false}
      />
      <div style={{ marginLeft: 20 }}>{children}</div>
    </Animator>
  )
}

const Sandbox = (): ReactElement => {
  return (
    <AnimatorGeneralProvider duration={{ enter: 0.6, stagger: 0.2 }}>
      <Item combine manager="sequence">
        <Item combine manager="parallel">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Item key={i} />
            ))}
        </Item>

        <Item combine manager="sequence">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Item key={i} />
            ))}
          <Item combine manager="sequenceReverse">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <Item key={i} />
              ))}
          </Item>
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Item key={i} />
            ))}
        </Item>

        <Item combine manager="stagger">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Item key={i} />
            ))}
          <Item combine manager="staggerReverse">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <Item key={i} />
              ))}
          </Item>
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Item key={i} />
            ))}
        </Item>
      </Item>
    </AnimatorGeneralProvider>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
