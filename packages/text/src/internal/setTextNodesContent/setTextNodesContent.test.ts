import { test, expect, vi } from 'vitest'

import { setTextNodesContent } from './setTextNodesContent'

test('Should set children nodes to empty', () => {
  const node1 = document.createElement('span')
  const node2 = document.createElement('span')
  const nodes = [node1, node2]
  const texts = ['abc', 'def']
  const callback = vi.fn()
  const length = 0
  setTextNodesContent(nodes, texts, length, callback)
  expect(node1.textContent).toBe('')
  expect(node2.textContent).toBe('')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(node1)
})

test('Should set children nodes partially empty', () => {
  const node1 = document.createElement('span')
  const node2 = document.createElement('span')
  const nodes = [node1, node2]
  const texts = ['abc', 'def']
  const callback = vi.fn()
  const length = 2
  setTextNodesContent(nodes, texts, length, callback)
  expect(node1.textContent).toBe('ab')
  expect(node2.textContent).toBe('')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(node1)
})

test('Should set children nodes partially exactly on half of nodes', () => {
  const node1 = document.createElement('span')
  const node2 = document.createElement('span')
  const nodes = [node1, node2]
  const texts = ['abc', 'def']
  const callback = vi.fn()
  const length = 3
  setTextNodesContent(nodes, texts, length, callback)
  expect(node1.textContent).toBe('abc')
  expect(node2.textContent).toBe('')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(node1)
})

test('Should set children nodes partially full', () => {
  const node1 = document.createElement('span')
  const node2 = document.createElement('span')
  const nodes = [node1, node2]
  const texts = ['abc', 'def']
  const callback = vi.fn()
  const length = 4
  setTextNodesContent(nodes, texts, length, callback)
  expect(node1.textContent).toBe('abc')
  expect(node2.textContent).toBe('d')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(node2)
})

test('Should set children nodes to full', () => {
  const node1 = document.createElement('span')
  const node2 = document.createElement('span')
  const nodes = [node1, node2]
  const texts = ['abc', 'def']
  const callback = vi.fn()
  const length = 6
  setTextNodesContent(nodes, texts, length, callback)
  expect(node1.textContent).toBe('abc')
  expect(node2.textContent).toBe('def')
  expect(callback).toHaveBeenCalledTimes(1)
  expect(callback).toHaveBeenCalledWith(node2)
})
