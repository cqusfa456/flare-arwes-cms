import { useEffect, useRef, useState } from 'react'
import {
  type BleepsProviderSettings,
  Animator,
  BleepsProvider,
  AnimatorGeneralProvider,
  Text,
  BleepsOnAnimator,
  Animated
} from '@arwes/react'

type BleepsNames = 'type'

const bleepsSettings: BleepsProviderSettings<BleepsNames> = {
  master: {
    volume: 0.5 // 50% of operating system volume.
  },
  common: {
    preload: false,
    disabled: false
  },
  categories: {
    background: { volume: 0.25 },
    transition: { volume: 0.5 },
    interaction: { volume: 0.75 },
    notification: { volume: 1 }
  },
  bleeps: {
    type: {
      category: 'transition',
      sources: [
        { src: '/assets/sounds/type.webm', type: 'audio/webm' },
        { src: '/assets/sounds/type.mp3', type: 'audio/mpeg' }
      ]
    }
  }
}

const OnAnimator = (): JSX.Element => {
  const [enabled, setEnabled] = useState(false)
  const [active, setActive] = useState(false)

  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 3_000 : 1_000)
    return () => clearTimeout(tid)
  }, [active])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        setEnabled(entry.isIntersecting)
      }
    })
    observer.observe(elementRef.current!)
    return () => observer.disconnect()
  }, [])

  return (
    <Animator root active={enabled && active}>
      <Animated className="flex flex-col gap-2 px-8 py-2 bg-primary-main-7/10" hideOnExited={false}>
        <Text elementRef={elementRef}>
          <BleepsOnAnimator<BleepsNames> transitions={{ entering: 'type', exiting: 'type' }} />
          The bleep will play on the animator state changes to enter and exit.
        </Text>
      </Animated>
    </Animator>
  )
}

const ExampleOnAnimator = (): JSX.Element => {
  return (
    <AnimatorGeneralProvider disabled={false} dismissed={false}>
      <BleepsProvider {...bleepsSettings}>
        <div>
          <OnAnimator />
        </div>
      </BleepsProvider>
    </AnimatorGeneralProvider>
  )
}

export { ExampleOnAnimator }
