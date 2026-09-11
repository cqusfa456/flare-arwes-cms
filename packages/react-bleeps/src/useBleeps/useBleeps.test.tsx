import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import type { ReactElement } from 'react'
import React from 'react'
import { render, cleanup } from '@testing-library/react'

import { BleepsProvider } from '../BleepsProvider/index'
import { useBleeps } from '../index'

const mockAudioContextDestination = Symbol('destination')

beforeEach(() => {
  class AudioContext {
    state = 'suspended'
    destination = mockAudioContextDestination
    resume = vi.fn()

    createGain(): object {
      return {
        connect: vi.fn(),
        gain: {
          value: 0,
          setValueAtTime: vi.fn()
        }
      }
    }
  }

  class Audio {
    canPlayType = vi.fn((type) => (type === 'audio/mpeg' ? 'probably' : ''))
  }

  window.AudioContext = AudioContext as any
  window.Audio = Audio as any
  window.fetch = vi.fn()
})

afterEach(() => {
  window.AudioContext = null as any
  window.Audio = null as any
  window.fetch = null as any

  cleanup()
})

test('Should render bleeps provider content', () => {
  const Button = (): ReactElement => {
    const bleeps = useBleeps()
    expect(bleeps.click).toBeTruthy()
    return <button>Click</button>
  }

  const { container } = render(
    <BleepsProvider
      master={{
        volume: 0.5
      }}
      bleeps={{
        click: {
          sources: [{ src: 'audio.mp3', type: 'audio/mpeg' }],
          preload: false
        }
      }}
    >
      <Button />
    </BleepsProvider>
  )
  expect(container.innerHTML).toBe('<button>Click</button>')
})
