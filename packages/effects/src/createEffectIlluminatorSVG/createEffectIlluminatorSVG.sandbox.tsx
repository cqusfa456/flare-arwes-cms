import { createEffectIlluminatorSVG } from '@arwes/effects'

const root = document.querySelector('#root')!

root.innerHTML = `
  <svg
    width="300"
    height="200"
    viewBox="0 0 300 200"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="none"
  >
    <defs>
      <clipPath id="clip">
        <path d="M0,0 L300,50 L300,150 L0,200" />
      </clipPath>
    </defs>
    <g id="container" clip-path="url(#clip)">
      <rect x="0" y="0" width="300" height="200" fill="hsl(180 19% 50% / 5%)" />
    </g>
  </svg>
`

const svg = document.querySelector('svg')!
const container = document.querySelector<SVGElement>('#container')!

const illuminator = createEffectIlluminatorSVG({
  svg,
  container,
  color: 'hsl(180 25% 50% / 20%)'
  // size: 300,
  // className: '',
  // style: {}
})

svg.addEventListener('dblclick', () => {
  illuminator.cancel()
})
