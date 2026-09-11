import { type BleepsOnAnimatorProps, BleepsOnAnimator } from '@arwes/react'
import { type BleepNames } from '@/config'

const AppBleepsOnAnimator = (props: BleepsOnAnimatorProps<BleepNames>): JSX.Element => {
  return <BleepsOnAnimator<BleepNames> {...props} />
}

export { AppBleepsOnAnimator }
