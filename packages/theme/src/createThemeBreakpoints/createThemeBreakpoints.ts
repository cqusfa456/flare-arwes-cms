/* eslint-disable @typescript-eslint/ban-types */

import type {
  ThemeSettingsBreakpointsKeyListItem,
  ThemeSettingsBreakpoints,
  ThemeBreakpoints
} from '../types.js'

const createThemeBreakpoints = <Keys extends string = string>(
  settings: ThemeSettingsBreakpoints<Keys> = []
): ThemeBreakpoints<Keys> => {
  const breakpoints = (
    settings.filter((item) => typeof item !== 'string') as unknown as Array<
      ThemeSettingsBreakpointsKeyListItem<Keys>
    >
  ).map((item) => item.key)

  const getBreakpointValue = (key: string | number): string => {
    if (typeof key === 'string') {
      for (const item of settings) {
        if (typeof item !== 'string' && item.key === key) {
          return item.value
        }
      }
      return key
    }
    const item = settings[key > settings.length - 1 ? settings.length - 1 : key]
    return typeof item === 'string' ? item : item.value
  }

  const up = (key: Keys | (string & {}), opts?: { strip?: boolean }): string => {
    const media = opts?.strip ? '' : '@media '
    return `${media}(min-width: ${getBreakpointValue(key)})`
  }

  const down = (key: Keys | (string & {}), opts?: { strip?: boolean }): string => {
    const media = opts?.strip ? '' : '@media '
    return `${media}(max-width: calc(${getBreakpointValue(key)} - 1px))`
  }

  const between = (
    startKey: Keys | (string & {}),
    endKey: Keys | (string & {}),
    opts?: { strip?: boolean }
  ): string => {
    const media = opts?.strip ? '' : '@media '
    const min = getBreakpointValue(startKey)
    const max = getBreakpointValue(endKey)

    return `${media}(min-width: ${min}) and (max-width: calc(${max} - 1px))`
  }

  return Object.freeze({
    breakpoints,
    settings,
    up,
    down,
    between
  })
}

export { createThemeBreakpoints }
