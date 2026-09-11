import { createFrame, createFrameKranoxSettings } from '@arwes/frames'
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
      --arwes-frames-bg-stroke: hsl(180, 75%, 20%);
      --arwes-frames-line-color: hsl(180, 75%, 30%);
      --arwes-frames-deco-color: hsl(180, 75%, 50%);
    "
  >
    <svg class="frame frame1" width="300" height="200" xmlns="http://www.w3.org/2000/svg"></svg>
    <svg class="frame frame2" width="300" height="400" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>

  <style>
    .frame { outline: 1px dashed hsl(180 0% 50% / 0.1); }
  </style>
`

createFrame(root.querySelector<SVGSVGElement>('.frame1')!, {
  animator,
  ...createFrameKranoxSettings({
    // styled: true,
    // animated: true,
    // padding: 0,
    // strokeWidth: 2,
    // bgStrokeWidth: 0,
    // squareSize: 16,
    // smallLineLength: 16,
    // largeLineLength: 64,
  })
})

createFrame(root.querySelector<SVGSVGElement>('.frame2')!, {
  animator,
  ...createFrameKranoxSettings({
    padding: 8,
    strokeWidth: 4,
    bgStrokeWidth: 1,
    squareSize: 24,
    smallLineLength: 24
  })
})

const update = (): void => {
  active = !active
  animator.send('update')
  setTimeout(update, active ? 3_000 : 1_000)
}

animator.send('setup')
update()
