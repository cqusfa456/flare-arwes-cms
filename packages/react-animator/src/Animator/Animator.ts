import {
  type ReactElement,
  type ReactNode,
  type ForwardedRef,
  type DependencyList,
  createElement,
  useMemo,
  useContext,
  useRef,
  useEffect,
  useState
} from 'react'

import {
  type AnimatorNode,
  type AnimatorSettingsPartial,
  type AnimatorInterface,
  ANIMATOR_STATES as STATES,
  ANIMATOR_ACTIONS as ACTIONS,
  createAnimatorSystem
} from '@arwes/animator'
import { AnimatorContext } from '../internal/AnimatorContext/index.js'
import { AnimatorGeneralContext } from '../internal/AnimatorGeneralContext/index.js'

interface AnimatorProps extends AnimatorSettingsPartial {
  root?: boolean
  disabled?: boolean
  dismissed?: boolean
  unmountOnExited?: boolean
  unmountOnEntered?: boolean
  unmountOnDisabled?: boolean
  refreshOn?: DependencyList
  nodeRef?: ForwardedRef<AnimatorNode>
  children?: ReactNode
}

const setNodeRefValue = (
  nodeRef: ForwardedRef<AnimatorNode> | undefined,
  node: AnimatorNode | null
): void => {
  if (typeof nodeRef === 'function') {
    nodeRef(node)
  } else if (nodeRef) {
    nodeRef.current = node
  }
}

const Animator = (props: AnimatorProps): ReactElement => {
  // It is responsibility of the <Animator> to register, setup, update, and unregister
  // the new node every time there is a change in it, since they happen on UI events.

  const {
    root,
    disabled,
    dismissed,
    unmountOnExited,
    unmountOnEntered,
    unmountOnDisabled,
    refreshOn,
    nodeRef,
    children,
    ...settings
  } = props

  const parentAnimatorInterface = useContext(AnimatorContext)
  const animatorGeneralInterface = useContext(AnimatorGeneralContext)

  const settingsRef = useRef<AnimatorSettingsPartial>(settings)
  const prevAnimatorRef = useRef<AnimatorInterface | undefined>(undefined)
  const isMountedRef = useRef<boolean>(true)

  settingsRef.current = settings

  const animatorGeneralSettings = animatorGeneralInterface?.getSettings()
  const isRoot = !!root || !parentAnimatorInterface
  const isDismissed = dismissed !== undefined ? !!dismissed : !!animatorGeneralSettings?.dismissed
  const isDisabled = disabled !== undefined ? !!disabled : !!animatorGeneralSettings?.disabled

  const animatorInterface: undefined | AnimatorInterface = useMemo(() => {
    if (prevAnimatorRef.current) {
      prevAnimatorRef.current.system.unregister(prevAnimatorRef.current.node)
    }

    if (isDismissed) {
      setNodeRefValue(nodeRef, null)
      return parentAnimatorInterface
    }

    if (isDisabled) {
      setNodeRefValue(nodeRef, null)
      return undefined
    }

    const system = isRoot ? createAnimatorSystem() : parentAnimatorInterface.system

    const getSettings = (): AnimatorSettingsPartial => {
      const animatorGeneralSettings = animatorGeneralInterface?.getSettings()

      const duration = {
        ...animatorGeneralSettings?.duration,
        ...settingsRef.current.duration
      }

      return {
        ...animatorGeneralSettings,
        ...settingsRef.current,
        duration
      }
    }

    const node = isRoot
      ? system.register(undefined, { getSettings })
      : system.register(parentAnimatorInterface.node, { getSettings })

    setNodeRefValue(nodeRef, node)

    return Object.freeze({ system, node })
  }, [parentAnimatorInterface, isRoot, isDisabled, isDismissed])

  prevAnimatorRef.current = animatorInterface

  const [isEnabledToUnmount, setIsEnabledToUnmount] = useState<boolean | undefined>(
    () =>
      (unmountOnExited && animatorInterface?.node.state === STATES.exited) ||
      (unmountOnEntered && animatorInterface?.node.state === STATES.entered) ||
      (unmountOnDisabled && isDisabled)
  )

  useEffect(() => {
    return () => {
      isMountedRef.current = false

      if (prevAnimatorRef.current) {
        prevAnimatorRef.current.system.unregister(prevAnimatorRef.current.node)
      }
    }
  }, [])

  // Setup on mounted and in case animator is disabled and then re-enabled,
  // trigger the setup once is created again.
  useEffect(() => {
    if (!animatorInterface) {
      return
    }

    queueMicrotask(() => {
      if (!isMountedRef.current) {
        return
      }
      animatorInterface.node.send(ACTIONS.setup)
    })
  }, [!!animatorInterface])

  // Trigger updates on animator only after first render, since in the first render
  // the setup event would take care of the initial data procedore.
  const isFirstRender1Ref = useRef<boolean>(true)
  useEffect(() => {
    if (isFirstRender1Ref.current) {
      isFirstRender1Ref.current = false
      return
    }

    if (!animatorInterface) {
      return
    }

    queueMicrotask(() => {
      if (!isMountedRef.current) {
        return
      }
      animatorInterface.node.send(ACTIONS.update)
    })
  }, [settings.active, settings.manager, settings.merge, settings.combine])

  useEffect(() => {
    if (animatorInterface) {
      const cancelSubscription = animatorInterface.node.subscribe((node) => {
        setIsEnabledToUnmount(
          (unmountOnExited && node.state === STATES.exited) ||
            (unmountOnEntered && node.state === STATES.entered)
        )
      })
      return () => cancelSubscription()
    } else {
      setIsEnabledToUnmount(unmountOnDisabled)
    }
  }, [animatorInterface, unmountOnExited, unmountOnEntered, unmountOnDisabled])

  const isFirstRender2Ref = useRef<boolean>(true)
  useEffect(() => {
    if (isFirstRender2Ref.current) {
      isFirstRender2Ref.current = false
      return
    }

    if (animatorInterface) {
      queueMicrotask(() => {
        if (!isMountedRef.current) {
          return
        }
        animatorInterface.node.send(ACTIONS.refresh)
      })
    }
  }, refreshOn ?? [])

  return createElement(
    AnimatorContext.Provider,
    { value: animatorInterface },
    isEnabledToUnmount ? null : children
  )
}

export type { AnimatorProps }
export { Animator }
