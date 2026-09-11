import {
  type BleepsProviderSettings,
  Animated,
  Animator,
  useBleeps,
  BleepsProvider,
  cx
} from '@arwes/react'

type BleepsNames = 'hover' | 'click'

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
    hover: {
      category: 'background',
      sources: [
        { src: '/assets/sounds/hover.webm', type: 'audio/webm' },
        { src: '/assets/sounds/hover.mp3', type: 'audio/mpeg' }
      ]
    },
    click: {
      category: 'interaction',
      sources: [
        { src: '/assets/sounds/click.webm', type: 'audio/webm' },
        { src: '/assets/sounds/click.mp3', type: 'audio/mpeg' }
      ]
    }
  }
}

const Button = (): JSX.Element => {
  const bleeps = useBleeps<BleepsNames>()

  return (
    <Animated
      as="button"
      className={cx(
        'inline-flex border px-4 py-2',
        'border-primary-main-5 text-primary-main-3 bg-primary-main-3/20'
      )}
      onMouseEnter={() => {
        bleeps.hover?.play()
      }}
      onClick={() => {
        bleeps.click?.play()
      }}
    >
      Hover or click me!
    </Animated>
  )
}

const ExampleButton = (): JSX.Element => {
  return (
    <BleepsProvider {...bleepsSettings}>
      <Animator>
        <div>
          <Button />
        </div>
      </Animator>
    </BleepsProvider>
  )
}

export { ExampleButton }
