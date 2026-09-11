import { type Bleep, useBleeps } from '@arwes/react'

import { type BleepNames } from '@/config'

const useAppBleeps = (): Record<BleepNames, Bleep | null> => {
  return useBleeps<BleepNames>()
}

export { useAppBleeps }
