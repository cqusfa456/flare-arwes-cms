'use client'

import { type ReactNode } from 'react'
import { AnimatorGeneralProvider } from '@arwes/react'
import { useAtom } from 'jotai'

import { animatorGeneralSettings, atomMotionEnabled } from '@/config'

/**
 * Animation context for CMS-rendered islands.
 *
 * The CMS pages are hydrated as their own Astro islands, so they are separate
 * React roots from `AppShell` and do not inherit its `AnimatorGeneralProvider`:
 * their animations ran with ARWES defaults and, more importantly, kept playing
 * even when the visitor had turned motion off. Providing the app's settings and
 * the motion preference here keeps the enter animation identical to the rest of
 * the site and honours "reduce motion".
 *
 * `atomMotionEnabled` is `atomWithStorage`, so it reads the same stored value in
 * this root as it does in the app shell.
 */
const CmsAnimator = (props: { children: ReactNode }): JSX.Element => {
  const [isMotionEnabled] = useAtom(atomMotionEnabled)

  return (
    <AnimatorGeneralProvider {...animatorGeneralSettings} disabled={!isMotionEnabled}>
      {props.children}
    </AnimatorGeneralProvider>
  )
}

export { CmsAnimator }
