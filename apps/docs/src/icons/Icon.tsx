import { type ReactNode } from 'react'

export type IconProps = {
  className?: string
  width?: number | string
  height?: number | string
  children?: ReactNode
}

export const Icon = (props: IconProps): JSX.Element => (
  <svg
    className={props.className}
    width={props.width ?? '1em'}
    height={props.height ?? '1em'}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {props.children}
  </svg>
)
