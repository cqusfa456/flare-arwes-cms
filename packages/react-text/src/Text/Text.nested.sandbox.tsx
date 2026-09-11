import React, { type ReactElement, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Animator } from '@arwes/react-animator'
import { Text } from '@arwes/react-text'

const Sandbox = (): ReactElement => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive((v) => !v), active ? 6_000 : 2_000)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator active={active} duration={{ enter: 5, exit: 1 }}>
      <Text
        as="div"
        style={{ color: '#aaa', fontFamily: 'Tomorrow' }}
        contentStyle={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div>
          Nemo enim ipsam <b>voluptatem quia voluptas</b> sit aspernatur aut odit aut fugit, sed
          quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro
          quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,{' '}
          <b>
            adipisci velit, <u>sed quia non</u>
          </b>
          numquam eius modi tempora incidunt.
        </div>
        <div>
          Ut labore et dolore magnam
          <span>
            <a href="#">aliquam quaerat</a>
          </span>{' '}
          voluptatem. Ut enim ad minima veniam, qui nostrum exercitationem ullam corporis suscipit.
        </div>
        <div>
          Sapien faucibus suspendisse neque congue netus <u>rhoncus tempus</u>. Dictumst quam neque
          at torquent nascetur commodo arcu <b>blandit tellus</b>. Lectus id et pharetra ante rutrum
          neque augue quisque.
        </div>
      </Text>
    </Animator>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
