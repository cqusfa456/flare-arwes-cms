import { filterProps } from '@arwes/tools'

import type {
  Bleep,
  BleepGeneralProps,
  BleepsManagerPropsUpdatable,
  BleepsManager,
  BleepsManagerProps,
  BleepCategory,
  BleepProps
} from '../types.js'
import { BLEEPS_CATEGORIES } from '../constants.js'
import { createBleep } from '../createBleep/index.js'

const categoryNames = Object.keys(BLEEPS_CATEGORIES) as BleepCategory[]

const createBleepsManager = <Names extends string>(
  propsInitials: BleepsManagerProps<Names>
): BleepsManager<Names> => {
  const props: BleepsManagerProps<Names> = structuredClone(propsInitials)

  // In non-browser environments, the bleeps manager is still created but without
  // actual functionalities.
  const isBleepsAvailable = typeof window !== 'undefined' && !!window.AudioContext
  const context = isBleepsAvailable ? new window.AudioContext() : (null as unknown as AudioContext)
  const masterGain = isBleepsAvailable ? context.createGain() : (null as unknown as GainNode)

  const bleepNames = new Set(Object.keys(props.bleeps) as Names[])
  const bleepsInternal = {} as unknown as Record<Names, Bleep | null>

  const syncVolume = (): void => {
    const globalVolume = Math.max(0, Math.min(1, props.master?.volume ?? 1))
    masterGain.gain.setValueAtTime(globalVolume, context.currentTime)
  }

  const getBleepProps = (bleepName: Names): BleepProps => {
    const bleepProps = props.bleeps[bleepName]
    const category = bleepProps.category ?? props.common?.category
    const categoryProps = category ? props.categories?.[category] : null
    const generalProps: BleepGeneralProps = { ...props.common, ...categoryProps }

    return { ...generalProps, ...bleepProps, context, masterGain }
  }

  const unload = (): void => {
    if (!isBleepsAvailable) {
      return
    }

    bleepNames.forEach((bleepName) => {
      bleepsInternal[bleepName]?.unload()
    })
  }

  const updateProps = (newProps: BleepsManagerPropsUpdatable): void => {
    if (newProps.master) {
      props.master = { ...props.master, ...filterProps(newProps.master) }
    }

    if (newProps.common) {
      props.common = { ...props.common, ...filterProps(newProps.common) }
    }

    const newCategoriesProps = newProps.categories
    if (newCategoriesProps) {
      categoryNames.forEach((category) => {
        props.categories = props.categories ?? {}
        props.categories[category] = {
          ...props.categories?.[category],
          ...newCategoriesProps[category]
        }
      })
    }

    const newBleepsProps = newProps.bleeps
    if (newBleepsProps) {
      // In case new bleeps are added in the update.
      Object.keys(newBleepsProps).forEach((key) => bleepNames.add(key as Names))

      bleepNames.forEach((bleepName) => {
        props.bleeps[bleepName] = {
          ...props.bleeps[bleepName],
          ...newBleepsProps[bleepName]
        }
      })
    }
  }

  const updateBleeps = (): void => {
    bleepNames.forEach((bleepName) => {
      const bleepProps = getBleepProps(bleepName)

      if (bleepProps.disabled) {
        const bleep = bleepsInternal[bleepName]
        if (bleep) {
          // In case the reference to the bleep was already used somewhere else,
          // mute the sound to prevent playback when it is supposed to be disabled.
          bleep.muted = true

          bleep.unload()
        }
        bleepsInternal[bleepName] = null
      } else {
        const bleep = bleepsInternal[bleepName]
        if (bleep) {
          bleep.update(bleepProps)
        } else {
          bleepsInternal[bleepName] = createBleep(bleepProps)
        }
      }
    })
  }

  const update = (newProps: BleepsManagerPropsUpdatable): void => {
    if (!isBleepsAvailable) {
      return
    }

    updateProps(newProps)
    syncVolume()
    updateBleeps()
  }

  if (isBleepsAvailable) {
    masterGain.connect(context.destination)

    syncVolume()
    updateBleeps()
  }

  const bleeps = new Proxy(bleepsInternal, {
    get(obj, key) {
      const bleepName = key as Names
      if (bleepNames.has(bleepName)) {
        return obj[bleepName]
      }
      console.error(
        `ARWES bleeps manager bleep "${bleepName}" was not found and can not be played.`
      )
      return null
    }
  }) as unknown as Record<Names, Bleep | null>

  return Object.freeze({ bleeps, unload, update })
}

export { createBleepsManager }
