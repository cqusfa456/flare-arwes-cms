'use client'

import React, { type ReactNode } from 'react'
import { AnimatorGeneralProvider, BleepsProvider, Animator } from '@arwes/react'
import { IconoirProvider } from 'iconoir-react'
import { useAtom } from 'jotai'

import {
  iconProviderProps,
  animatorGeneralSettings,
  bleepsSettings,
  atomMotionEnabled,
  atomAudioEnabled,
  theme
} from '@/config'
import { Background, Header } from '@/ui'

const LayoutRoot = (props: { children: ReactNode; blogPath?: string }): JSX.Element => {
  const [isMotionEnabled] = useAtom(atomMotionEnabled)
  const [isAudioEnabled] = useAtom(atomAudioEnabled)

  return (
    <IconoirProvider {...iconProviderProps}>
      <AnimatorGeneralProvider {...animatorGeneralSettings} disabled={!isMotionEnabled}>
        <BleepsProvider
          {...bleepsSettings}
          common={{ ...bleepsSettings.common, disabled: !isAudioEnabled }}
        >
          <div
            className="absolute inset-0 overflow-hidden flex flex-col"
            style={{
              // @ts-expect-error ARWES variables.
              '--arwes-frames-bg-color': theme.colors.primary.main(9, { alpha: 0.15 }),
              '--arwes-frames-line-color': theme.colors.primary.main(9, { alpha: 0.8 }),
              '--arwes-frames-deco-color': theme.colors.primary.main(7, { alpha: 0.8 }),

              // ARWES font families are loaded via Google Fonts in the
              // Astro layout and set as CSS variables in `globals.css`.
              scrollbarWidth: 'thin',
              scrollbarColor: `${theme.colors.secondary.main(7)} transparent`
            }}
          >
            <Animator combine>
              <Animator combine>
                <Background />
              </Animator>

              <Animator combine manager="sequence">
                <div className="relative flex-1 flex flex-col min-w-0 min-h-0">
                  <Animator combine>
                    <Header blogPath={props.blogPath} />
                  </Animator>

                  <div className="flex-1 flex min-w-0 min-h-0">{props.children}</div>
                </div>
              </Animator>
            </Animator>
          </div>
        </BleepsProvider>
      </AnimatorGeneralProvider>
    </IconoirProvider>
  )
}

export { LayoutRoot }
