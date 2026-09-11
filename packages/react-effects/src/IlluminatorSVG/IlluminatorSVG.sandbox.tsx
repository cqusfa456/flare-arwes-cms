import React, { useRef, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { IlluminatorSVG } from '@arwes/react-effects'

const Sandbox = (): ReactElement => {
  const svgRef = useRef<SVGSVGElement>(null)

  return (
    <div>
      <p style={{ color: '#fff' }}>Move mouse over the page.</p>
      <svg
        ref={svgRef}
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
        <g clipPath="url(#clip)">
          <IlluminatorSVG svgRef={svgRef} color="hsl(180 50% 50% / 20%)" size={300} />
        </g>
      </svg>
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
