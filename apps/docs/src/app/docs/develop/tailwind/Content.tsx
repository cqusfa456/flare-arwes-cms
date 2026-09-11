'use client'

import { AR } from '@/ui'

export default (): JSX.Element => (
  <>
    <AR.Header>Tailwind</AR.Header>

    <AR.P>
      ARWES theming tools can be easily integrated with{' '}
      <a href="https://tailwindcss.com" target="_blank">
        Tailwind
      </a>{' '}
      without any extra package. Since the theming tools are primitives, it should be done manually,
      which allows for flexibility and scalability.
    </AR.P>

    <AR.P>Create a theme as required:</AR.P>

    <AR.CodeBlock
      filename="/src/theme.ts"
      lang="tsx"
      code={`import {
  createThemeUnit,
  createThemeMultiplier,
  createThemeColor,
  createThemeBreakpoints
} from 'arwes'

const theme = Object.freeze({
  // REM units.
  space: createThemeUnit((index) => \`\${index * 0.25}rem\`),

  // Pixel units.
  spacen: createThemeMultiplier((index) => index * 4),

  // Media query breakpoints.
  breakpoints: createThemeBreakpoints([
    { key: '3sm', value: '375px' },
    { key: '2sm', value: '410px' },
    { key: 'sm', value: '640px' },
    { key: 'md', value: '768px' },
    { key: 'lg', value: '1024px' },
    { key: 'xl', value: '1280px' },
    { key: '2xl', value: '1536px' },
    { key: '3xl', value: '1980px' }
  ]),

  // Color palettes.
  colors: {
    primary: createThemeColor(i => [180, 10 + i, 92.5 - i * 9.44]),
    secondary: createThemeColor(i => [60, 10 + i, 92.5 - i * 9.44])
  },

  // Typography.
  fontFamily: {
    header: ['Tomorrow', 'sans-serif'],
    body: ['Roboto', 'sans-serif']
  }
})

export { theme }`}
    />

    <AR.P>Then integrate it with the Tailwind config file:</AR.P>

    <AR.CodeBlock
      filename="/tailwind.config.ts"
      lang="tsx"
      code={`import type { Config } from 'tailwindcss'

// Import the theme definition.
import { theme } from './src/theme'

// Convert an ARWES theme breakpoints to a Tailwind screens settings.
const createTWScreens = (): Record<string, string> =>
  theme.breakpoints.settings
    .map(({ key, value }) => ({ [key]: value }))
    .reduce((t, i) => ({ ...t, ...i }), {})

// Convert an ARWES theme color to a Tailwind color palette settings.
const createTWPalette = (
  createColor: (i: number) => string,
  length: number
): Record<string, string> =>
  Array(length)
    .fill(null)
    .map((_, i) => ({ [i]: createColor(i) }))
    .reduce((t, i) => ({ ...t, ...i }), {})

export const tailwind: Config = {
  content: ['./src/**/*.{html,js,ts,md,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: createTWScreens(),
      colors: {
        primary: createTWPalette(theme.colors.primary, 10),
        secondary: createTWPalette(theme.colors.secondary, 10)
      },
      // \`fontFamily\` can be passed just like this.
      fontFamily: theme.fontFamily

      // Tailwind \`spacing\` is the same as the theme \`space\` setting.
    }
  }
}`}
    />

    <AR.P>
      Now in the source code, new Tailwind classes are available with screen breakpoints, color
      palettes, and typography.
    </AR.P>

    <AR.CodeBlock
      filename="/src/page.html"
      lang="html"
      code={`<article class="flex flex-col gap-2">
  <h1 class="font-header text-primary-4 text-3xl 3sm:text-4xl">
    ARWES
  </h1>
  <p class="font-body text-secondary-4">
    Futuristic Sci-Fi UI Web Framework.
  </p>
</article>`}
    />

    <AR.Navigation prevHref="/docs/develop" prev="Develop" />
  </>
)
