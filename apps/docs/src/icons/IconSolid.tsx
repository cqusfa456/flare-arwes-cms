import { memo } from 'react'
import { type IconProps, Icon } from './Icon'

export const IconSolid = memo((props: IconProps): JSX.Element => {
  return (
    <Icon {...props}>
      <path
        d="M2 17.5C6.66667 20.5 10 22 12 22C14.5 22 16 20.5 16 18.5C16 16.5 14.5 15 12 15C10 15 6.66667 15.8333 2 17.5Z"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.529 20.285L18.412 16.46C18.796 15.908 19 15.238 19 14.5C19 12.5 17.5 11 15 11C13 11 9.66667 11.8333 5 13.5L2 17.5M19 10.5L22 6.5C18 3.5 14 2 12 2C9.96 2 9.382 2.463 8.581 3.545L5.628 7.256"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.416 12.662C5.906 12.186 5 11.183 5 9.5C5 7 6.5 6 9 6C10.688 6 14.087 7.068 17.198 9.204C17.8028 9.63019 18.4035 10.0622 19 10.5L16.698 11.285"
        stroke="currentcolor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  )
})
