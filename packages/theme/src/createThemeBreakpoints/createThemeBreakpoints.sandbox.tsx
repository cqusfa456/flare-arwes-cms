import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { createThemeBreakpoints } from '@arwes/theme'

const bps = createThemeBreakpoints([
  { key: 'small', value: '400px' },
  { key: 'medium', value: '800px' },
  { key: 'large', value: '1200px' }
])

const addStyles = (css: string): void => {
  const style = document.createElement('style')
  style.innerHTML = css
  document.body.appendChild(style)
}

addStyles(`
  .box {
    margin: 20px;
    width: 150px;
    height: 150px;
    background: cyan;
  }

  ${bps.up('small')} { /* Also possible: bps.up('400px') */
    .box {
      background: magenta;
    }
  }
  ${bps.up('medium')} {
    .box {
      background: yellow;
    }
  }
  ${bps.up('large')} {
    .box {
      background: green;
    }
  }

  ${bps.down('medium')} {
    .box {
      border-radius: 30%;
    }
  }

  ${bps.between('medium', 'large')} {
    .box {
      transform: skew(-10deg);
    }
  }
`)

const Sandbox = (): ReactElement => {
  return <div className="box" />
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
