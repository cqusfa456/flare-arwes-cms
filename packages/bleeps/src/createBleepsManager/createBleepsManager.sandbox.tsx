import { createBleepsManager } from '@arwes/bleeps'

const rootElement = document.querySelector('#root')!

rootElement.innerHTML = `
  <button class="click">Click</button>
  <button class="error">Error</button>
`

const clickElement = rootElement.querySelector('.click')!
const errorElement = rootElement.querySelector('.error')!

type BleepNames = 'click' | 'error'

const bleepsManager = createBleepsManager<BleepNames>({
  bleeps: {
    click: {
      sources: [
        { src: '/assets/sounds/click.webm', type: 'audio/webm' },
        { src: '/assets/sounds/click.mp3', type: 'audio/mpeg' }
      ]
    },
    error: {
      sources: [
        { src: '/assets/sounds/error.webm', type: 'audio/webm' },
        { src: '/assets/sounds/error.mp3', type: 'audio/mpeg' }
      ]
    }
  }
})

clickElement.addEventListener('click', () => {
  bleepsManager.bleeps.click?.play()
})

errorElement.addEventListener('click', () => {
  bleepsManager.bleeps.error?.play()
})
