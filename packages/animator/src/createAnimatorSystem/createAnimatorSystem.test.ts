import { test, expect } from 'vitest'

import type { AnimatorSystemRegisterSetup } from '../types'
import { ANIMATOR_DEFAULT_SETTINGS } from '../constants'
import { createAnimatorSystem } from './createAnimatorSystem'

test('Should create a system with predefined structure', () => {
  const system = createAnimatorSystem()
  expect(system).toEqual({
    id: expect.any(String),
    register: expect.any(Function),
    unregister: expect.any(Function)
  })
})

test('Should create system id with format "s#"', () => {
  const system = createAnimatorSystem()
  expect(system.id).toMatch(/^s\d+$/)
})

test('Should register new root node with predefined structure', () => {
  const system = createAnimatorSystem()
  const nodeSetup: AnimatorSystemRegisterSetup = {
    getSettings: () => ({})
  }
  const node = system.register(undefined, nodeSetup)
  expect(node).toEqual({
    _parent: undefined,
    _children: expect.any(Set),
    _subscribers: expect.any(Set),
    _watchers: expect.any(Set),
    _scheduler: expect.any(Object),
    _getUserSettings: expect.any(Function),
    _manager: expect.any(Object),

    id: expect.any(String),
    state: ANIMATOR_DEFAULT_SETTINGS.initialState,
    control: {
      getSettings: expect.any(Function),
      setSettings: expect.any(Function),
      getForeign: expect.any(Function),
      setForeign: expect.any(Function)
    },
    settings: {
      ...ANIMATOR_DEFAULT_SETTINGS,
      onTransition: expect.any(Function)
    },
    subscribe: expect.any(Function),
    unsubscribe: expect.any(Function),
    send: expect.any(Function)
  })
})

test('Should create node id with format "s#-n#" with parent system id', () => {
  const system = createAnimatorSystem()
  const nodeSetup: AnimatorSystemRegisterSetup = {
    getSettings: () => ({})
  }
  const node = system.register(undefined, nodeSetup)
  expect(node.id).toMatch(/^s\d+-n\d+$/)
  expect(node.id.startsWith(system.id + '-')).toBeTruthy()
})

test('Should throw by trying to register parentless node with existing root', () => {
  const system = createAnimatorSystem()
  system.register()
  expect(() => system.register()).toThrow(
    'ARWES animator root node must be unregistered before registering another root node.'
  )
})

test('Should throw by trying to register parentless node with existing root', () => {
  const system1 = createAnimatorSystem()
  const system2 = createAnimatorSystem()
  const node = system1.register()
  expect(() => system2.register(node)).toThrow(
    'ARWES animator system requires an animator root node before registering children nodes. This means the provided animator parent node does not belong to the system.'
  )
})
