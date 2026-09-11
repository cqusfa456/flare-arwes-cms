import { createAnimatorSystem } from '@arwes/animator'
import { createAnimatedElement } from '@arwes/animated'

const root = document.querySelector('#root')!
root.innerHTML = `
  <style>
    .box {
      width: 50px;
      height: 50px;
      background: #777;
    }
  </style>
  <div class="box"><div>
`
const element = document.querySelector<HTMLElement>('.box')!

let active = false
let isCancelled = false

const system = createAnimatorSystem()
const animator = system.register(undefined, {
  getSettings: () => ({ active, duration: { enter: 1, exit: 1 } })
})

const animatedElement = createAnimatedElement({
  element,
  animator,
  settingsRef: {
    current: {
      animated: ['fade', ['x', 0, 100], ['background', '#0ff', '#ff0']]
    }
  }
})

const update = (): void => {
  if (isCancelled) {
    return
  }
  active = !active
  animator.send('update')
  setTimeout(update, active ? 2_000 : 1_500)
}

element.addEventListener('dblclick', () => {
  animatedElement.cancel()
  isCancelled = true
})

animator.send('setup')
update()
