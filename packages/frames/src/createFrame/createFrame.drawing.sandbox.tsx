import { createAnimatorSystem } from '@arwes/animator'
import { type FrameSettings, createFrame } from '@arwes/frames'

let active = false

const system = createAnimatorSystem()
const animator = system.register(undefined, {
  getSettings: () => ({ active, duration: { enter: 1, exit: 1 } })
})

const root = document.querySelector('#root')!
root.innerHTML = `<svg width="100%" height="200" xmlns="http://www.w3.org/2000/svg"></svg>`

const svg = root.querySelector('svg')!

const settings: FrameSettings = {
  animator,
  elements: [
    {
      type: 'g',
      style: { fill: 'none', strokeWidth: '2', stroke: 'orange' },
      animated: ['flicker'],
      elements: [
        {
          type: 'g',
          animated: [['x', 50, 0]],
          elements: [
            {
              animated: ['draw'],
              path: [
                ['M', 1, 51],
                ['v', -20],
                ['c', 0, 0, 0, -30, 100, -30]
              ]
            },
            {
              animated: ['draw'],
              path: [
                ['M', 1, '100% - 51'],
                ['v', 20],
                ['c', 0, 0, 0, 30, 100, 30]
              ]
            }
          ]
        },
        {
          type: 'g',
          animated: [['x', -50, 0]],
          elements: [
            {
              animated: ['draw'],
              path: [
                ['M', '100% - 1', 51],
                ['v', -20],
                ['c', 0, 0, 0, -30, -100, -30]
              ]
            },
            {
              animated: ['draw'],
              path: [
                ['M', '100% - 1', '100% - 51'],
                ['v', 20],
                ['c', 0, 0, 0, 30, -100, 30]
              ]
            }
          ]
        }
      ]
    }
  ]
}

createFrame(svg, settings)

const update = (): void => {
  active = !active
  animator.send('update')
  setTimeout(update, active ? 3_000 : 1_500)
}

animator.send('setup')
update()
