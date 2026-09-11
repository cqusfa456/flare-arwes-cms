import { styleFrameClipKranox } from '@arwes/frames'

const root = document.querySelector('#root')!

const box = document.createElement('div')
root.appendChild(box)
Object.assign(box.style, {
  width: '200px',
  height: '400px',
  background: '#077',
  clipPath: styleFrameClipKranox({
    squareSize: '16px'
    // strokeWidth = '1px',
    // smallLineLength = '16px',
    // largeLineLength = '64px',
    // padding = '0px'
  })
})
