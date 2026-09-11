import { createBleepsManager } from '@arwes/bleeps'

const rootElement = document.querySelector('#root')!

rootElement.innerHTML = `
  <button class="click">Click</button>
  <button class="error">Error</button>
  <button class="type">Readout</button>
`

const clickElement = rootElement.querySelector('.click')!
const errorElement = rootElement.querySelector('.error')!
const assembleElement = rootElement.querySelector('.type')!

type BleepNames = 'click' | 'error' | 'type'

const bleepsManager = createBleepsManager<BleepNames>({
  common: {
    volume: 0.5
  },
  categories: {
    interaction: {
      volume: 0
    },
    notification: {
      volume: 0.5
    },
    transition: {
      volume: 1
    }
  },
  bleeps: {
    click: {
      category: 'interaction',
      sources: [{ src: '/assets/sounds/click.mp3', type: 'audio/mpeg' }]
    },
    error: {
      category: 'notification',
      sources: [{ src: '/assets/sounds/error.mp3', type: 'audio/mpeg' }]
    },
    type: {
      category: 'transition',
      sources: [{ src: '/assets/sounds/type.mp3', type: 'audio/mpeg' }]
    }
  }
})

clickElement.addEventListener('click', () => {
  bleepsManager.bleeps.click?.play()
})

errorElement.addEventListener('click', () => {
  bleepsManager.bleeps.error?.play()
})

assembleElement.addEventListener('click', () => {
  bleepsManager.bleeps.type?.play()
})
