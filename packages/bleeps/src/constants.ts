import type { BleepCategory } from './types.js'

export const BLEEPS_CATEGORIES: { [P in BleepCategory]: P } = {
  background: 'background',
  transition: 'transition',
  interaction: 'interaction',
  notification: 'notification',
  voice: 'voice'
}
