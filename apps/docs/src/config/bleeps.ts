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

export const bleepsSettings: BleepsProviderSettings<BleepNames> = {
  master: { volume: 0.5 },
  categories: {
    background: { volume: 0.25, muteOnWindowBlur: true },
    transition: { volume: 0.5, muteOnWindowBlur: true },
    interaction: { volume: 0.75 },
    notification: { volume: 1 }
  },
  bleeps: {
    // Background bleeps.
    hover: {
      category: 'background',
      sources: [
        { src: '/assets/sounds/hover.webm', type: 'audio/webm' },
        { src: '/assets/sounds/hover.mp3', type: 'audio/mpeg' }
      ]
    },

    // Transition bleeps.
    intro: {
      category: 'transition',
      sources: [
        { src: '/assets/sounds/intro.webm', type: 'audio/webm' },
        { src: '/assets/sounds/intro.mp3', type: 'audio/mpeg' }
      ]
    },
    content: {
      category: 'transition',
      sources: [
        { src: '/assets/sounds/content.webm', type: 'audio/webm' },
        { src: '/assets/sounds/content.mp3', type: 'audio/mpeg' }
      ]
    },
    type: {
      category: 'transition',
      sources: [
        { src: '/assets/sounds/type.webm', type: 'audio/webm' },
        { src: '/assets/sounds/type.mp3', type: 'audio/mpeg' }
      ],
      loop: true
    },
    assemble: {
      category: 'transition',
      sources: [
        { src: '/assets/sounds/assemble.webm', type: 'audio/webm' },
        { src: '/assets/sounds/assemble.mp3', type: 'audio/mpeg' }
      ],
      loop: true
    },

    // Interaction bleeps.
    click: {
      category: 'interaction',
      sources: [
        { src: '/assets/sounds/click.webm', type: 'audio/webm' },
        { src: '/assets/sounds/click.mp3', type: 'audio/mpeg' }
      ]
    },
    open: {
      category: 'interaction',
      sources: [
        { src: '/assets/sounds/open.webm', type: 'audio/webm' },
        { src: '/assets/sounds/open.mp3', type: 'audio/mpeg' }
      ]
    },
    close: {
      category: 'interaction',
      sources: [
        { src: '/assets/sounds/close.webm', type: 'audio/webm' },
        { src: '/assets/sounds/close.mp3', type: 'audio/mpeg' }
      ]
    },

    // Notification bleeps.
    info: {
      category: 'notification',
      sources: [
        { src: '/assets/sounds/info.webm', type: 'audio/webm' },
        { src: '/assets/sounds/info.mp3', type: 'audio/mpeg' }
      ]
    },
    error: {
      category: 'notification',
      sources: [
        { src: '/assets/sounds/error.webm', type: 'audio/webm' },
        { src: '/assets/sounds/error.mp3', type: 'audio/mpeg' }
      ]
    }
  }
}
