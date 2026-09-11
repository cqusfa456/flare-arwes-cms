import React, { type ReactElement, useState, useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { animate } from 'motion'
import { type AnimatorNode } from '@arwes/animator'
import { Animator, useAnimator } from '@arwes/react-animator'

const AnimatorUIListener = (): ReactElement => {
  const elementRef = useRef<HTMLDivElement>(null)
  const animator = useAnimator()!

  useEffect(() => {
    const element = elementRef.current

    // If the animator is disabled or dismissed, ignore animations.
    // Also, if the element doesn't exist, ignore animations too.
    if (!animator || !element) {
      return
    }

    // Any animation tool such as:
    // - https://motion.dev
    // - https://www.framer.com/motion
    // - https://gsap.com
    // - https://animejs.com
    // can be used to animate.
    // The animation should have a way to be cancelled for cleanup purposes.
    let animation: { cancel: () => void } | undefined

    // A subscription function to be called every time the state changes.
    // It is called when subscribed initially.
    const unsubscribe = animator.node.subscribe((node: AnimatorNode) => {
      // For most cases, the animations are to be executed on enter and exit transitions.
      switch (node.state) {
        case 'entering': {
          animation?.cancel() // Cancel current animation.
          animation = animate(
            element,
            { x: [0, 100], background: ['#0ff', '#ff0'] },
            { duration: node.settings.duration.enter }
          )
          break
        }
        case 'exiting': {
          animation?.cancel() // Cancel current animation.
          animation = animate(
            element,
            { x: [100, 0], background: ['#ff0', '#0ff'] },
            { duration: node.settings.duration.exit }
          )
          break
        }
      }
    })

    return () => {
      animation?.cancel()
      unsubscribe()
    }
  }, [animator])

  return <div ref={elementRef} style={{ margin: 10, width: 40, height: 40, background: '#777' }} />
}

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setInterval(() => setActive((active) => !active), 2_000)
    return () => clearInterval(tid)
  }, [])

  return (
    <Animator active={active}>
      <AnimatorUIListener />
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
