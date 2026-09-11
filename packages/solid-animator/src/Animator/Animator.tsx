// TODO: Compose settings condition.
// TODO: Compose settings onTransition.
// TODO: Add support for refresh.
// TODO: Add support for prop unmountOnExited.
// TODO: Add support for prop unmountOnEntered.
// TODO: Add support for prop unmountOnDisabled.
// TODO: Add support for prop nodeRef.

import { type JSX, type Component, createMemo, createEffect, onCleanup } from 'solid-js'
import { filterProps } from '@arwes/tools'
import {
  type AnimatorInterface,
  type AnimatorSettingsPartial,
  createAnimatorSystem
} from '@arwes/animator'

import { AnimatorContext } from '../internal/AnimatorContext.js'
import { useGetAnimator } from '../useGetAnimator/index.js'

interface AnimatorProps extends AnimatorSettingsPartial {
  root?: boolean
  disabled?: boolean
  dismissed?: boolean
  children?: JSX.Element
}

const Animator: Component<AnimatorProps> = (props) => {
  const getParentAnimatorInterface = useGetAnimator()
  const parentAnimatorInterface = getParentAnimatorInterface?.()

  const settingsComponentRef: { current: AnimatorSettingsPartial } = { current: {} }
  const settingsDynamicRef: { current: AnimatorSettingsPartial | null } = { current: null }

  const getParentInterface = createMemo<AnimatorInterface | undefined>(() =>
    props.root ? undefined : parentAnimatorInterface
  )
  const getIsDisabled = createMemo<boolean>(() => !!props.disabled)
  const getIsDismissed = createMemo<boolean>(() => !!props.dismissed)

  createMemo(() => {
    settingsComponentRef.current = {
      active: props.active,
      duration: props.duration,
      manager: props.manager,
      merge: props.merge,
      combine: props.combine,
      initialState: props.initialState,
      condition: props.condition,
      onTransition: props.onTransition
    }
  })

  const getAnimatorInterface = createMemo<AnimatorInterface | undefined>(
    (prevAnimatorInterface) => {
      const parentInterface = getParentInterface()
      const isDisabled = getIsDisabled()
      const isDismissed = getIsDismissed()

      if (isDisabled) {
        if (prevAnimatorInterface) {
          prevAnimatorInterface.system.unregister(prevAnimatorInterface.node)
        }

        return undefined
      }

      if (isDismissed) {
        if (prevAnimatorInterface) {
          prevAnimatorInterface.system.unregister(prevAnimatorInterface.node)
        }

        return parentInterface
      }

      if (prevAnimatorInterface) {
        prevAnimatorInterface.system.unregister(prevAnimatorInterface.node)
      }

      const getSettings = (): AnimatorSettingsPartial => {
        return {
          ...filterProps(settingsComponentRef.current),
          ...(settingsDynamicRef.current ? filterProps(settingsDynamicRef.current) : null),
          duration: {
            ...(settingsComponentRef.current.duration
              ? filterProps(settingsComponentRef.current.duration)
              : null),
            ...(settingsDynamicRef.current?.duration
              ? filterProps(settingsDynamicRef.current?.duration)
              : null)
          }
        }
      }

      const system = parentInterface ? parentInterface.system : createAnimatorSystem()
      const parentNode = parentInterface ? parentInterface.node : undefined
      const node = system.register(parentNode, { getSettings })

      return Object.freeze({ system, node })
    }
  )

  createEffect(() => {
    const animatorInterface = getAnimatorInterface()

    if (animatorInterface) {
      queueMicrotask(() => {
        animatorInterface.node.send('setup')
      })
    }
  })

  createEffect(() => {
    void props.root
    void props.disabled
    void props.dismissed
    void props.active
    void props.combine
    void props.merge
    void props.manager

    const animatorInterface = getAnimatorInterface()

    if (animatorInterface) {
      queueMicrotask(() => {
        animatorInterface.node.send('update')
      })
    }
  })

  onCleanup(() => {
    const animatorInterface = getAnimatorInterface()

    if (animatorInterface) {
      animatorInterface.system.unregister(animatorInterface.node)
    }
  })

  return (
    <AnimatorContext.Provider value={getAnimatorInterface}>
      {props.children}
    </AnimatorContext.Provider>
  )
}

export type { AnimatorProps }
export { Animator }
