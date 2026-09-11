import type { AnimatorNode } from '../types.js'

const isNodeConditionCorrect = (
  node: AnimatorNode,
  condition: undefined | boolean | ((node: AnimatorNode) => boolean)
): boolean =>
  typeof condition === 'function'
    ? condition(node)
    : typeof condition === 'boolean'
      ? condition
      : true

export { isNodeConditionCorrect }
