import { createBleep } from '@arwes/bleeps'

const rootElement = document.querySelector('#root')!

rootElement.innerHTML = `
  <button class="playAll">Play All</button>
  <button class="stopOne">Stop One</button>
  <button class="stopAll">Stop All</button>
`

const playAllElement = rootElement.querySelector('.playAll')!
const stopOneElement = rootElement.querySelector('.stopOne')!
const stopAllElement = rootElement.querySelector('.stopAll')!

const bleep = createBleep({
  sources: [
    { src: '/assets/sounds/type.webm', type: 'audio/webm' },
    { src: '/assets/sounds/type.mp3', type: 'audio/mpeg' }
  ],
  loop: true,
  muteOnWindowBlur: true
})

playAllElement.addEventListener('click', () => {
  bleep?.play('A')
  bleep?.play('B')
  bleep?.play('C')
})

stopOneElement.addEventListener('click', () => {
  bleep?.stop('B')
})

stopAllElement.addEventListener('click', () => {
  bleep?.stop('A')
  bleep?.stop('B')
  bleep?.stop('C')
})
