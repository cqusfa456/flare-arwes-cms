import { createAnimation } from '@arwes/animated'

const rootElement = document.querySelector('#root')!

rootElement.innerHTML = `
  <style>
    .item {
      margin: 20px;
      width: 40px;
      height: 40px;
      background: #0ff;
    }
  </style>

  <div class="item"></div>
`

const itemElement = rootElement.querySelector<HTMLDivElement>('.item')!

createAnimation({
  duration: 1,
  easing: 'inOutSine',
  onUpdate: (progress) => {
    itemElement.style.transform = `translateX(${progress * 200}px)`
  },
  onFinish: () => {
    itemElement.style.background = '#ff0'
  }
})
