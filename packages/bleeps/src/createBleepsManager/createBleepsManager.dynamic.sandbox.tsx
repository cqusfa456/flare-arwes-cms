import { createBleepsManager } from '@arwes/bleeps'

const rootElement = document.querySelector('#root')!

rootElement.innerHTML = `
  <div style="color:#ddd;">
    <div style="margin-bottom:20px;">
      <label>
        Global Volume
        <input
          class="volume"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value="1"
        />
      </label>

      <label>
        <input class="disable" type="checkbox">
        <span>Disable Bleeps</span>
      </label>
    </div>

    <div>
      <button class="click">Click</button>
      <button class="error">Error</button>
      <button class="type">Readout</button>
    </div>
  </div>
`

const volumeElement = rootElement.querySelector<HTMLInputElement>('.volume')!
const disableElement = rootElement.querySelector<HTMLInputElement>('.disable')!
const clickElement = rootElement.querySelector('.click')!
const errorElement = rootElement.querySelector('.error')!
const assembleElement = rootElement.querySelector('.type')!

type BleepsNames = 'click' | 'error' | 'type'

const bleepsManager = createBleepsManager<BleepsNames>({
  master: {
    volume: 1
  },
  categories: {
    interaction: {
      volume: 0.25
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

volumeElement.addEventListener('change', () => {
  const volume = volumeElement.valueAsNumber
  bleepsManager.update({
    master: { volume }
  })
})

disableElement.addEventListener('change', () => {
  const disabled = disableElement.checked
  bleepsManager.update({
    common: { disabled }
  })
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
