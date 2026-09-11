import { createFrame, createFrameOctagonSettings } from '@arwes/frames'
import { createAnimatorSystem } from '@arwes/animator'

let active = false
const system = createAnimatorSystem()
const animator = system.register(undefined, {
  getSettings: () => ({ active, duration: { enter: 1, exit: 0.5 } })
})

const root = document.querySelector('#root')!
root.innerHTML = `
  <div
    style="
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      --arwes-frames-bg-color: hsl(180, 75%, 10%);
      --arwes-frames-line-color: hsl(180, 75%, 30%);
      --arwes-frames-deco-color: hsl(180, 75%, 50%);
    "
  >
    <svg class="frame frame1" width="200" height="200" xmlns="http://www.w3.org/2000/svg"></svg>
    <svg class="frame frame2" width="300" height="300" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>

  <style>
    .frame { outline: 1px dashed hsl(180 0% 50% / 0.1); }
  </style>
`

createFrame(root.querySelector('.frame1')!, {
  animator,
  ...createFrameOctagonSettings({
    // styled: true,
    // animated: true,
    // padding: 0,
    // leftTop: true,
    // rightTop: true,
    // rightBottom: true,
    // leftBottom: true,
    // squareSize: 16,
    // strokeWidth: 1
  })
})

createFrame(root.querySelector('.frame2')!, {
  animator,
  ...createFrameOctagonSettings({
    padding: 10,
    leftTop: false,
    rightBottom: false,
    squareSize: 32,
    strokeWidth: 3
  })
})

const update = (): void => {
  active = !active
  animator.send('update')
  setTimeout(update, active ? 3_000 : 1_000)
}

animator.send('setup')
update()
