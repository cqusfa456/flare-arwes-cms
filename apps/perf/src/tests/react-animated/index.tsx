import React, { type ReactElement, Profiler, Fragment, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

const Test = (): ReactElement => {
  const [total, setTotal] = useState(1000)
  const [active, setActive] = useState(false)
  const [state, setState] = useState('exited')

  useEffect(() => {
    const tid = setInterval(() => setActive((v) => !v), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Fragment>
      <div className="controls">
        <label className="control">
          children:
          <select value={total} onChange={(event) => setTotal(+event.currentTarget.value)}>
            <option value="100">100</option>
            <option value="500">500</option>
            <option value="1000">1,000</option>
            <option value="2000">2,000</option>
            <option value="3000">3,000</option>
            <option value="5000">5,000</option>
            <option value="7000">7,000</option>
            <option value="10000">10,000</option>
          </select>
        </label>
        <div className="control">{active ? 'active' : 'inactive'}</div>
        <div className="control">{state}</div>
      </div>

      <Animator
        active={active}
        duration={{ enter: 0.5, exit: 0.5 }}
        onTransition={(node) => setState(node.state)}
      >
        <div className="items">
          {Array(total)
            .fill(null)
            .map((_, index) => (
              <Animated
                key={index}
                className="item"
                animated={{
                  initialStyle: {
                    opacity: 0.1
                  },
                  transitions: {
                    entering: { opacity: 1 },
                    exiting: { opacity: 0.1 }
                  }
                }}
              />
            ))}
        </div>
      </Animator>
    </Fragment>
  )
}

const onProfileRender = (id: string, phase: string, duration: number): void => {
  console.log(`[Profiler] ${phase} = ${duration} ms`)
}

const App = (): ReactElement => {
  return (
    <Profiler id="test" onRender={onProfileRender}>
      <Test />
    </Profiler>
  )
}

createRoot(document.querySelector('#root')!).render(<App />)
