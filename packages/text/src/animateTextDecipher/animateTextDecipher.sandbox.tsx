import { animateTextDecipher } from '@arwes/text'

const root = document.querySelector('#root')!

root.innerHTML = `
  <h1
    id="rootElement"
    style="position: relative; color: #0dd; font-family: monospace;"
  >
    <div
      id="contentElement"
      style="position: relative;"
    >Futuristic Sci-Fi UI Web Framework</div>
  </h1>
`

const rootElement = document.querySelector<HTMLElement>('#rootElement')!
const contentElement = document.querySelector<HTMLElement>('#contentElement')!

animateTextDecipher({
  rootElement,
  contentElement,
  duration: 1
  // easing: 'linear',
  // isEntering: true,
  // hideOnExited: true,
  // hideOnEntered: false,
  // characters: '    ----____abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
})
