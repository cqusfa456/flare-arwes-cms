import React, { type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import {
  type ThemeSettingsUnit,
  type ThemeSettingsMultiplier,
  type ThemeSettingsColor,
  type ThemeSettingsStyle,
  type ThemeUnit,
  type ThemeMultiplier,
  type ThemeColor,
  type ThemeStyle,
  type ThemeCreatorStructure,
  createCreateTheme
} from '@arwes/theme'

interface ThemeSettings {
  space: ThemeSettingsUnit
  outline: ThemeSettingsMultiplier
  font: ThemeSettingsStyle
  color: {
    primary: ThemeSettingsColor
    secondary: ThemeSettingsColor
  }
}

interface Theme {
  space: ThemeUnit
  outline: ThemeMultiplier
  font: ThemeStyle
  color: {
    primary: ThemeColor
    secondary: ThemeColor
  }
}

const themeStructure: ThemeCreatorStructure = {
  space: 'unit',
  outline: 'multiplier',
  font: 'style',
  color: {
    primary: 'color',
    secondary: 'color'
  }
}

const themeDefaults: ThemeSettings = {
  // Values to be multiplied by a provided integer.
  space: (i) => `${i * 0.25}rem`,
  outline: 1,
  // A list of styles with any CSS properties.
  font: [
    { fontFamily: 'Tomorrow', fontWeight: 500, fontSize: '2rem' },
    { fontFamily: '"Titillium Web"', fontWeight: 300, fontSize: '1.5rem' }
  ],
  color: {
    // A function to return a HSLA value as [number, number, number, number?].
    // The colors go from light to dark.
    primary: (i) => [180, 60 + i, 92.5 - i * 9.44],
    secondary: (i) => [60, 60 + i, 92.5 - i * 9.44]
  }
}

const createTheme = createCreateTheme<ThemeSettings, Theme>(themeStructure, themeDefaults)

const theme = createTheme({
  outline: 3
})

const Sandbox = (): ReactElement => {
  return (
    <div
      style={{
        padding: theme.space([4, 8]),
        background: theme.color.primary(9)
      }}
    >
      <h1
        style={{
          ...theme.font(0),
          margin: theme.space([0, 0, 4]),
          borderBottomWidth: theme.outline(1),
          borderBottomStyle: 'solid',
          borderBottomColor: theme.color.primary(6),
          paddingBottom: theme.space(4),
          color: theme.color.primary(4)
        }}
      >
        ARWES
      </h1>
      <p style={{ ...theme.font(1), margin: 0, color: theme.color.secondary(4) }}>
        Futuristic Sci-Fi UI Web Framework
      </p>
    </div>
  )
}

createRoot(document.querySelector('#root')!).render(<Sandbox />)
