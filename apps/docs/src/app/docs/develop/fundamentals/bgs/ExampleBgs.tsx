import { useState, useEffect } from 'react'
import {
  Animated,
  Animator,
  AnimatorGeneralProvider,
  Dots,
  GridLines,
  MovingLines,
  Puffs
} from '@arwes/react'

import { theme } from '@/config'

const color = theme.colors.secondary.main(3, { alpha: 0.5 })

const ExampleBgs = (): JSX.Element => {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const tid = setTimeout(() => setActive(!active), active ? 2_500 : 1_500)
    return () => clearTimeout(tid)
  }, [active])

  return (
    <Animator unmountOnExited>
      <AnimatorGeneralProvider duration={{ enter: 1, exit: 1 }}>
        <Animator root active={active} disabled={false} dismissed={false}>
          <Animated
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-6"
            data-name="example"
          >
            <Dots className="w-full h-40" positioned={false} color={color} />
            <Dots
              className="w-full h-40"
              positioned={false}
              color={color}
              type="cross"
              size={10}
              crossSize={2}
              originInverted
            />
            <GridLines className="w-full h-40" positioned={false} lineColor={color} />
            <GridLines
              className="w-full h-40"
              positioned={false}
              lineColor={color}
              horizontalLineDash={[8]}
              verticalLineDash={[4, 2]}
            />
            <MovingLines
              className="w-full h-40"
              positioned={false}
              lineColor={color}
              distance={15}
              sets={25}
            />
            <MovingLines
              className="w-full h-40"
              positioned={false}
              lineColor={color}
              distance={5}
              sets={100}
            />
            <Puffs
              className="w-full h-40"
              positioned={false}
              color={color}
              quantity={20}
              padding={0}
            />
            <Puffs
              className="w-full h-40"
              positioned={false}
              color={color}
              quantity={50}
              padding={0}
              xOffset={[10, 50]}
              yOffset={[0, 0]}
              radiusOffset={[10, 20]}
            />
          </Animated>
        </Animator>
      </AnimatorGeneralProvider>
    </Animator>
  )
}

export { ExampleBgs }
