import React, { type ReactNode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { type BleepsProviderSettings, BleepsProvider, useBleeps } from '@arwes/react-bleeps'

type BleepsNames = 'click' | 'intro'

interface ButtonProps {
  name: BleepsNames
  children: ReactNode
}

const Button = (props: ButtonProps): JSX.Element => {
  const { name, children } = props
  const bleeps = useBleeps<BleepsNames>()
  const onClick = (): void => bleeps[name]?.play()
  return <button onClick={onClick}>{children}</button>
}

const bleepsSettings: BleepsProviderSettings<BleepsNames> = {
  categories: {
    interaction: { volume: 0.5 },
    notification: { volume: 1 }
  },
  bleeps: {
    click: {
      category: 'interaction',
      sources: [
        { src: '/assets/sounds/click.webm', type: 'audio/webm' },
        { src: '/assets/sounds/click.mp3', type: 'audio/mpeg' }
      ]
    },
    intro: {
      category: 'notification',
      sources: [
        { src: '/assets/sounds/intro.webm', type: 'audio/webm' },
        { src: '/assets/sounds/intro.mp3', type: 'audio/mpeg' }
      ]
    }
  }
}

const Sandbox = (): JSX.Element => {
  const [volume, setVolume] = useState(1)
  const [disabled, setDisabled] = useState(false)

  return (
    <BleepsProvider {...bleepsSettings} master={{ volume }} common={{ disabled }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#ddd' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button name="click">Click!</Button>
          <Button name="intro">Intro!</Button>
        </div>

        <label>
          Global Volume
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(event) => setVolume(Number(event.currentTarget.value))}
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.currentTarget.checked)}
          />
          <span>Disable Bleeps</span>
        </label>
      </div>
    </BleepsProvider>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
