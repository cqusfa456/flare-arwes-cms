import { createTOScheduler, filterProps } from '@arwes/tools'

import type {
  AnimatorControl,
  AnimatorSubscriber,
  AnimatorWatcher,
  AnimatorNode,
  AnimatorSystem,
  AnimatorSystemRegisterSetup,
  AnimatorSettings,
  AnimatorSettingsPartial
} from '../types.js'
import { ANIMATOR_DEFAULT_SETTINGS } from '../constants.js'
import { createAnimatorMachine } from '../internal/createAnimatorMachine.js'
import { createAnimatorManager } from '../internal/createAnimatorManager.js'
import { isNodeConditionCorrect } from '../internal/isNodeConditionCorrect.js'

const createAnimatorSystem = (): AnimatorSystem => {
  const systemId = `s${Math.random()}`.replace('.', '')

  let nodeIdCounter = 0
  let root: AnimatorNode | undefined

  const createNode = (
    parent?: undefined | null | AnimatorNode,
    setup?: AnimatorSystemRegisterSetup
  ): AnimatorNode => {
    const nodeId = `${systemId}-n${nodeIdCounter++}`

    // The node object reference is passed around in multiple places with some
    // circular references, so this is an object base and later is modified
    // with specific readonly and writable properties.
    const node = { id: nodeId } as unknown as AnimatorNode

    let dynamicSettingsOptional: null | AnimatorSettingsPartial = null
    let foreign: unknown = null

    const control: AnimatorControl = Object.freeze({
      getSettings: () => {
        const setupSettings = setup?.getSettings() || {}
        const dynamicSettings = dynamicSettingsOptional || {}
        return {
          ...setupSettings,
          ...dynamicSettings,
          duration: {
            ...setupSettings.duration,
            ...dynamicSettings.duration
          },
          condition:
            dynamicSettings.condition !== undefined
              ? dynamicSettings.condition
              : setupSettings.condition !== undefined
                ? setupSettings.condition
                : undefined,
          onTransition: (node) => {
            setupSettings.onTransition?.(node)
            dynamicSettings.onTransition?.(node)
          }
        }
      },

      setSettings: (newSettings) => {
        if (newSettings === null) {
          dynamicSettingsOptional = null
          return
        }
        dynamicSettingsOptional = {
          ...dynamicSettingsOptional,
          ...newSettings,
          duration: {
            ...dynamicSettingsOptional?.duration,
            ...newSettings.duration
          }
        }
      },

      getForeign: () => foreign,

      setForeign: (value) => {
        foreign = value
      }
    })

    const initialSettings = control.getSettings()
    const machine = createAnimatorMachine(
      node,
      initialSettings.initialState ?? ANIMATOR_DEFAULT_SETTINGS.initialState
    )
    const manager = createAnimatorManager(
      node,
      initialSettings.manager ?? ANIMATOR_DEFAULT_SETTINGS.manager
    )

    const nodeProps: { [P in keyof AnimatorNode]: PropertyDescriptor } = {
      _parent: {
        value: parent,
        enumerable: true
      },
      _children: {
        value: new Set<AnimatorNode>(),
        enumerable: true
      },
      _subscribers: {
        value: new Set<AnimatorSubscriber>(),
        enumerable: true
      },
      _watchers: {
        value: new Set<AnimatorWatcher>(),
        enumerable: true
      },
      _scheduler: {
        value: createTOScheduler(),
        enumerable: true
      },
      _getUserSettings: {
        value: () => {
          const controlSettings = node.control.getSettings()
          return {
            ...ANIMATOR_DEFAULT_SETTINGS,
            ...filterProps(controlSettings),
            duration: {
              ...ANIMATOR_DEFAULT_SETTINGS.duration,
              ...(controlSettings.duration ? filterProps(controlSettings.duration) : null)
            }
          }
        },
        enumerable: true
      },
      _manager: {
        value: manager,
        enumerable: true,
        writable: true
      },

      id: {
        value: nodeId,
        enumerable: true
      },
      state: {
        get: () => machine.getState(),
        enumerable: true
      },
      control: {
        value: control,
        enumerable: true
      },
      settings: {
        get: (): AnimatorSettings => {
          const settings = node._getUserSettings()
          let enter = settings.duration.enter
          if (settings.combine) {
            const children = Array.from(node._children).filter((child) => {
              const { condition } = child.control.getSettings()
              return isNodeConditionCorrect(child, condition)
            })
            enter = node._manager.getDurationEnter(children)
          }
          return { ...settings, duration: { ...settings.duration, enter } }
        },
        enumerable: true
      },
      subscribe: {
        value: (subscriber: AnimatorSubscriber): (() => void) => {
          node._subscribers.add(subscriber)
          subscriber(node)
          return () => node._subscribers.delete(subscriber)
        },
        enumerable: true
      },
      unsubscribe: {
        value: (subscriber: AnimatorSubscriber): void => {
          node._subscribers.delete(subscriber)
        },
        enumerable: true
      },
      send: {
        value: machine.send,
        enumerable: true
      }
    }

    Object.defineProperties(node, nodeProps)

    if (parent) {
      parent._children.add(node)
    }

    return node
  }

  const removeNode = (node: AnimatorNode): void => {
    node._scheduler.stopAll()

    for (const child of node._children) {
      removeNode(child)
    }

    if (node._parent) {
      node._parent._children.delete(node)
    }

    node._children.clear()
    node._subscribers.clear()
    node._watchers.clear()
  }

  const register = (
    parentNode?: undefined | null | AnimatorNode,
    setup?: AnimatorSystemRegisterSetup
  ): AnimatorNode => {
    if (parentNode === undefined || parentNode === null) {
      if (root) {
        throw new Error(
          'ARWES animator root node must be unregistered before registering another root node.'
        )
      }

      root = createNode(undefined, setup)

      return root
    }

    if (!root) {
      throw new Error(
        'ARWES animator system requires an animator root node before registering children nodes. This means the provided animator parent node does not belong to the system.'
      )
    }

    return createNode(parentNode, setup)
  }

  const unregister = (node: AnimatorNode): void => {
    if (!root) {
      return
    }

    for (const watcher of node._watchers) {
      watcher(node)
    }

    removeNode(node)

    if (root.id === node.id) {
      root = undefined
    }
  }

  // System object reference so it can have dynamic object properties setup later.
  const system = {} as unknown as AnimatorSystem

  const systemProps: { [P in keyof AnimatorSystem]: PropertyDescriptor } = {
    id: {
      value: systemId,
      enumerable: true
    },
    root: {
      get: () => root,
      enumerable: true
    },
    register: {
      value: register,
      enumerable: true
    },
    unregister: {
      value: unregister,
      enumerable: true
    }
  }

  Object.defineProperties(system, systemProps)

  return system
}

export { createAnimatorSystem }
