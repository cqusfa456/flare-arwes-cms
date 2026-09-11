import type { Config } from 'tailwindcss'
import { theme } from './theme'

const createTWScreens = (): Record<string, string> =>
  theme.breakpoints.settings
    .map(({ key, value }) => ({ [key]: value }))
    .reduce((t, i) => ({ ...t, ...i }), {})

const createTWPalette = (
  createColor: (i: number) => string,
  length: number
): Record<string, string> =>
  Array(length)
    .fill(null)
    .map((_, i) => ({ [i]: createColor(i) }))
    .reduce((t, i) => ({ ...t, ...i }), {})

export const tailwind: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  plugins: [require('@tailwindcss/typography')],
  theme: {
    extend: {
      screens: createTWScreens(),
      colors: {
        primary: {
          low: createTWPalette(theme.colors.primary.low, 13),
          main: createTWPalette(theme.colors.primary.main, 13),
          high: createTWPalette(theme.colors.primary.high, 13)
        },
        secondary: {
          low: createTWPalette(theme.colors.secondary.low, 13),
          main: createTWPalette(theme.colors.secondary.main, 13),
          high: createTWPalette(theme.colors.secondary.high, 13)
        },
        neutral: createTWPalette(theme.colors.neutral, 13),
        error: createTWPalette(theme.colors.error, 13)
      },
      fontFamily: theme.fontFamily,
      fontSize: {
        'size-0': '3rem',
        'size-1': '2.5rem',
        'size-2': '2.25rem',
        'size-3': '2rem',
        'size-4': '1.75rem',
        'size-5': '1.5rem',
        'size-6': '1.3125rem',
        'size-7': '1.125rem',
        'size-8': '1rem',
        'size-9': '0.875rem',
        'size-10': '0.75rem',
        'size-11': '0.625rem',
        'size-12': '0.5rem'
      },
      dropShadow: {
        'size-1': `0 0 0.0625rem var(--tw-shadow-color)`,
        'size-2': `0 0 0.125rem var(--tw-shadow-color)`,
        'size-3': `0 0 0.25rem var(--tw-shadow-color)`,
        'size-4': `0 0 0.5rem var(--tw-shadow-color)`,
        'size-5': `0 0 1rem var(--tw-shadow-color)`,
        'size-6': `0 0 1.5rem var(--tw-shadow-color)`
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            fontFamily: theme.fontFamily.body.join(),
            fontWeight: 300,
            lineHeight: 1.4,
            color: theme.colors.primary.low(2),

            'h1,h2,h3,h4,h5,h6': {
              fontFamily: theme.fontFamily.header.join(),
              fontWeight: 300,
              textWrap: 'pretty',
              color: theme.colors.primary.main(3)
            },
            'p svg': {
              display: 'inline-block'
            },
            'b, strong': {
              fontWeight: 600
            },
            a: {
              color: theme.colors.secondary.low(2),
              textDecoration: 'none',
              transition: 'all ease-out 200ms'
            },
            'a:hover': {
              color: theme.colors.secondary.high(3)
            },
            blockquote: {
              fontStyle: 'normal',
              fontWeight: 300,
              color: 'inherit',
              borderInlineStartColor: theme.colors.primary.main(3),
              backgroundColor: theme.colors.primary.main(3, { alpha: 0.1 }),
              clipPath: `polygon(
                0 0,
                calc(100% - 0.5rem) 0,
                100% 0.5rem,
                100% calc(100% - 0.5rem),
                calc(100% - 0.5rem) 100%,
                0 100%
              )`
            },
            ul: {
              listStyleType: '"➣"'
            },
            code: {
              whiteSpace: 'nowrap',
              fontFamily: theme.fontFamily.code.join(),
              fontWeight: 400,
              color: 'inherit'
            }
          }
        },
        sm: {
          css: {
            '[role="table"], [data-name="codeblock"], [data-name="links"], [data-name="example"], [data-name="playground"]':
              {
                marginTop: `${24 / 14}rem`,
                marginBottom: `${24 / 14}rem`
              }
          }
        },
        base: {
          css: {
            '[role="table"], [data-name="codeblock"], [data-name="links"], [data-name="example"], [data-name="playground"]':
              {
                marginTop: `${32 / 16}rem`,
                marginBottom: `${32 / 16}rem`
              }
          }
        }
      }
    }
  }
}
