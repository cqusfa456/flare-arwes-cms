import React, { type HTMLAttributes, type ReactNode } from 'react'
import { type AnimatedProp, Animated, cx, memo, useBleeps } from '@arwes/react'

import { type BleepNames } from '@/config'
import styles from './MenuItem.module.css'

interface MenuProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
  animated?: AnimatedProp
  active?: boolean
  children: ReactNode
}

const MenuItem = memo((props: MenuProps): JSX.Element => {
  const { className, animated, children, active, ...otherProps } = props

  const bleeps = useBleeps<BleepNames>()

  return (
    <Animated
      {...otherProps}
      as="li"
      className={cx(
        'relative',
        'flex flex-row justify-center items-center gap-2',
        'h-full',
        'font-cta text-size-10 uppercase',
        'transition-[color] duration-200 ease-out',
        !!active && 'text-secondary-main-5 hover:text-secondary-high-2',
        !active && 'text-primary-main-5 hover:text-primary-high-2',
        // bottom line background
        !!active &&
          cx(
            'before:absolute before:origin-center before:inset-x-0 before:bottom-0 before:border-t',
            'before:transition-[transform,opacity] before:duration-200 before:ease-out',
            'before:border-t-current before:opacity-80',
            'hover:before:opacity-60'
          ),
        // bottom line
        'after:absolute after:origin-center after:inset-x-0 after:bottom-0 after:scale-x-[0] after:border-t',
        'after:transition-[transform,opacity] after:duration-200 after:ease-out',
        'after:border-t-current',
        'hover:after:scale-x-[1]',
        //
        styles.root,
        className
      )}
      animated={animated}
      onClick={(event) => {
        otherProps.onClick?.(event)
        bleeps.click?.play()
      }}
    >
      {children}
    </Animated>
  )
})

export { MenuItem }
