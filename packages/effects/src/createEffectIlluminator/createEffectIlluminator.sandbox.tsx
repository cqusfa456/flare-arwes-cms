import { createEffectIlluminator } from '@arwes/effects'
import { styleFrameClipOctagon } from '@arwes/frames'

const root = document.querySelector('#root')!

const container = document.createElement('div')
Object.assign(container.style, {
  width: '300px',
  height: '200px',
  background: 'hsl(180 19% 50% / 5%)',
  clipPath: styleFrameClipOctagon({ squareSize: '30px' })
})
root.appendChild(container)

const illuminator = createEffectIlluminator({
  container,
  color: 'hsl(180 25% 50% / 20%)'
  // size: 300,
  // className: '',
  // style: {}
})

container.addEventListener('dblclick', () => {
  illuminator.cancel()
})
