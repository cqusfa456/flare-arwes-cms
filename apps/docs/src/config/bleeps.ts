import { type BleepsProviderSettings } from '@arwes/react'

export type BleepNames =
  | 'click'
  | 'open'
  | 'close'
  | 'error'
  | 'info'
  | 'intro'
  | 'content'
  | 'type'
  | 'hover'
  | 'assemble'

// The sample files that actually ship with this repository. The other ARWES
// website audio files are licensed for that site only — see the README in
// static/assets/sounds — so they are not in the repository and must not be
// referenced here: every page load requested them (webm, then mp3), got a 404
// for each, and played nothing.
type SampleName = 'click' | 'type' | 'info' | 'error'

type BleepSources = NonNullable<BleepsProviderSettings<BleepNames>['bleeps']>[BleepNames]['sources']

const sample = (name: SampleName): BleepSources => [
  { src: `/assets/sounds/${name}.webm`, type: 'audio/webm' },
  { src: `/assets/sounds/${name}.mp3`, type: 'audio/mpeg' }
]

export const bleepsSettings: BleepsProviderSettings<BleepNames> = {
  master: { volume: 0.5 },
  categories: {
    background: { volume: 0.25, muteOnWindowBlur: true },
    transition: { volume: 0.5, muteOnWindowBlur: true },
    interaction: { volume: 0.75 },
    notification: { volume: 1 }
  },
  bleeps: {
    // Background bleeps. "hover" has no sample of its own; the short click is
    // the closest one that ships.
    hover: {
      category: 'background',
      sources: sample('click')
    },

    // Transition bleeps. "intro" is played on the home page, so it maps to a
    // sample rather than being dropped.
    intro: {
      category: 'transition',
      sources: sample('info')
    },
    content: {
      category: 'transition',
      sources: sample('type')
    },
    type: {
      category: 'transition',
      sources: sample('type'),
      loop: true
    },
    assemble: {
      category: 'transition',
      sources: sample('type'),
      loop: true
    },

    // Interaction bleeps.
    click: {
      category: 'interaction',
      sources: sample('click')
    },
    open: {
      category: 'interaction',
      sources: sample('click')
    },
    close: {
      category: 'interaction',
      sources: sample('click')
    },

    // Notification bleeps.
    info: {
      category: 'notification',
      sources: sample('info')
    },
    error: {
      category: 'notification',
      sources: sample('error')
    }
  }
}
