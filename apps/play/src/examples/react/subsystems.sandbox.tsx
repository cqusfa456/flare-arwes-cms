import React, { type ReactElement, useState, type CSSProperties, useEffect, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Animated } from '@arwes/react-animated'

// LINK

interface LinkProps {
  path: string
  bg: string
  bgActive: string
  active: boolean
  children: ReactNode
  onLink: (path: string) => void
}

const Link = (props: LinkProps): ReactElement => {
  const { path, bg, bgActive, active, children, onLink } = props
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: active ? bgActive : bg,
        fontFamily: 'Tomorrow',
        cursor: 'pointer',
        transition: 'background 200ms ease-out'
      }}
      onClick={() => onLink(path)}
    >
      {children}
    </div>
  )
}

// HEADER

interface HeaderProps {
  path: string
  onLink: (path: string) => void
}

const Header = (props: HeaderProps): ReactElement => {
  const { path, onLink } = props
  return (
    <Animator>
      <Animated
        as="header"
        style={{
          gridArea: 'header',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          padding: '1rem',
          background: '#055'
        }}
        animated={['fade', ['y', 20, 0]]}
      >
        <Link path="a" active={path === 'a'} bg="#550" bgActive="#aa0" onLink={onLink}>
          A
        </Link>
        <Link path="b" active={path === 'b'} bg="#707" bgActive="#c0c" onLink={onLink}>
          B
        </Link>
        <Link path="c" active={path === 'c'} bg="#050" bgActive="#0a0" onLink={onLink}>
          C
        </Link>
        <Link path="" active={path === ''} bg="#555" bgActive="#aaa" onLink={onLink}>
          Exit
        </Link>
      </Animated>
    </Animator>
  )
}

// FOOTER

const Footer = (): ReactElement => (
  <Animator>
    <Animated
      as="footer"
      style={{ gridArea: 'footer', background: '#055' }}
      animated={['fade', ['y', -20, 0]]}
    />
  </Animator>
)

// PANEL LEFT

const PanelLeft = (): ReactElement => (
  <Animator>
    <Animated
      as="aside"
      style={{ gridArea: 'panelLeft', background: '#055' }}
      animated={['fade', ['x', 20, 0]]}
    />
  </Animator>
)

// PANEL RIGHT

const PanelRight = (): ReactElement => (
  <Animator>
    <Animated
      as="aside"
      style={{ gridArea: 'panelRight', background: '#055' }}
      animated={['fade', ['x', -20, 0]]}
    />
  </Animator>
)

// ITEM

interface ItemProps {
  style?: CSSProperties
  bg: string
}

const Item = (props: ItemProps): ReactElement => {
  const { style, bg } = props
  return (
    <Animator>
      <Animated style={{ ...style, background: bg }} animated={['fade']} />
    </Animator>
  )
}

// SUBSYSTEMS

const SubsystemA = (): ReactElement => (
  <Animator manager="stagger" combine>
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateRows: 'repeat(5, 1fr)',
        width: '100%',
        height: '100%'
      }}
    >
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <Item key={i} bg="#550" />
        ))}
    </div>
  </Animator>
)

const SubsystemB = (): ReactElement => (
  <Animator manager="stagger" combine>
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateRows: 'repeat(5, 1fr)',
        width: '100%',
        height: '100%'
      }}
    >
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <Item key={i} bg="#707" />
        ))}
    </div>
  </Animator>
)

const SubsystemC = (): ReactElement => (
  <Animator manager="stagger" combine>
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateRows: 'repeat(5, 1fr)',
        width: '100%',
        height: '100%'
      }}
    >
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <Item key={i} bg="#050" />
        ))}
    </div>
  </Animator>
)

//

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)
  const [path, setPath] = useState('a')

  useEffect(() => {
    if (path === '') {
      setActive(false)
    }
  }, [path])

  return (
    <Animator active={active} manager="stagger" combine duration={{ stagger: 0.1 }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '1rem',
          color: '#fff'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateAreas: `
              "header header header"
              "panelLeft main panelRight"
              "footer footer footer"
            `,
            gridTemplateColumns: '20% 1fr 20%',
            gridTemplateRows: 'minmax(80px, 10%) 1fr minmax(80px, 10%)',
            gap: '1rem',
            margin: '0 auto',
            width: '100%',
            maxWidth: 900,
            height: '100%'
          }}
        >
          <Animator combine>
            <Header path={path} onLink={(path) => setPath(path)} />
            <Footer />
          </Animator>
          <Animator combine>
            <Animator combine manager="switch" refreshOn={[path]}>
              <Animator combine condition={() => path === 'a' || path === 'b'}>
                <PanelLeft />
              </Animator>
            </Animator>
            <Animator combine manager="switch" refreshOn={[path]}>
              <Animator combine condition={() => path === 'a'}>
                <PanelRight />
              </Animator>
            </Animator>
          </Animator>
          <main style={{ gridArea: 'main' }}>
            <Animator combine manager="switch" refreshOn={[path]}>
              <Animator combine unmountOnExited condition={() => path === 'a'}>
                <SubsystemA />
              </Animator>
              <Animator combine unmountOnExited condition={() => path === 'b'}>
                <SubsystemB />
              </Animator>
              <Animator combine unmountOnExited condition={() => path === 'c'}>
                <SubsystemC />
              </Animator>
            </Animator>
          </main>
        </div>
      </div>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
