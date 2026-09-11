import React, { type ReactElement, Profiler, Fragment, useState, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import { AnimatorGeneralProvider, Animator, useAnimator } from '@arwes/react-animator'

const Item = (): ReactElement => {
  const elementRef = useRef<HTMLDivElement>(null)
  const animator = useAnimator()!

  useEffect(() => {
    animator.node.subscribe((node) => {
      const element = elementRef.current!

      switch (node.state) {
        case 'exited':
          element.style.opacity = '0.05'
          break
        case 'entering':
          element.style.opacity = '0.5'
          break
        case 'entered':
          element.style.opacity = '1'
          break
        case 'exiting':
          element.style.opacity = '0.5'
          break
      }
    })
  }, [])

  return <div ref={elementRef} className="item" />
}

const Test = (): ReactElement => {
  const [total, setTotal] = useState(1000)
  const [active, setActive] = useState(false)
  const [state, setState] = useState('exited')

  useEffect(() => {
    const tid = setInterval(() => {
      setActive((v) => {
        console.time('duration-to-notify-first-child')
        console.time(v ? `duration-to-exit-all-children` : `duration-to-enter-all-children`)
        return !v
      })
    }, 2_000)
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

      <AnimatorGeneralProvider duration={{ enter: 0.5, exit: 0.5 }}>
        <Animator active={active} combine onTransition={(node) => setState(node.state)}>
          <div className="items">
            {Array(total)
              .fill(null)
              .map((_, index) => (
                <Animator
                  key={index}
                  onTransition={(node) => {
                    const state = node.state
                    if (index === 0) {
                      console.time(`duration-to-walk-and-transition-to-${state}-all-children`)

                      if (node.state === 'entering' || node.state === 'exiting') {
                        console.timeEnd('duration-to-notify-first-child')
                      }
                    }
                    //
                    else if (index + 1 === total) {
                      console.timeEnd(`duration-to-walk-and-transition-to-${state}-all-children`)

                      if (node.state === 'entering') {
                        console.timeEnd('duration-to-enter-all-children')
                      }
                      if (node.state === 'exiting') {
                        console.timeEnd('duration-to-exit-all-children')
                      }
                    }
                  }}
                >
                  <Item />
                </Animator>
              ))}
          </div>
        </Animator>
      </AnimatorGeneralProvider>
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
