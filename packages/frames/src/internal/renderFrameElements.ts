import type { AnimatorNode } from '@arwes/animator'
import {
  type AnimatedXAnimationFunctionReturn,
  type AnimatedElement,
  createAnimatedElement,
  applyAnimatedCSSProps
} from '@arwes/animated'

import type { FrameSettingsElement } from '../types.js'

const renderFrameElements = (
  parent: SVGElement,
  elements: FrameSettingsElement[],
  animator: undefined | AnimatorNode,
  animations: Map<SVGElement, Map<string, AnimatedXAnimationFunctionReturn>>
): void => {
  const children = Array.from(parent.children) as SVGElement[]

  for (let index = 0; index < elements.length; index++) {
    const settings = elements[index]

    const element =
      children[index] ??
      document.createElementNS('http://www.w3.org/2000/svg', settings.type ?? 'path')

    const { name, id, className, style } = settings

    if (name) {
      element.dataset.name = name
    }

    if (id) {
      element.id = id
    }

    if (className) {
      element.classList.value = className
    }

    if (style) {
      applyAnimatedCSSProps(element, style)
    }

    if (settings.type === 'svg') {
      element.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }

    switch (settings.type) {
      case 'svg':
      case 'g':
      case 'defs':
      case 'clipPath':
      case 'mask': {
        if (typeof settings.elements === 'string') {
          element.innerHTML = settings.elements
        } else {
          renderFrameElements(element, settings.elements, animator, animations)
        }
        break
      }
    }

    if (animator && settings.animated) {
      const elementAnimations =
        animations.get(element) ?? new Map<string, AnimatedXAnimationFunctionReturn>()

      const currentAnimatedElement = elementAnimations.get('__animator__') as
        | undefined
        | AnimatedElement<SVGElement>

      if (currentAnimatedElement) {
        // TODO: Should it check if the same animator node is received on re-render and update it?
        // Or just assume it is always the same and leave it as it is?

        currentAnimatedElement.settingsRef.current = {
          ...settings.animatedSettings,
          animated: settings.animated
        }
      }
      //
      else {
        const animatedElement = createAnimatedElement({
          element,
          animator,
          settingsRef: {
            current: {
              ...settings.animatedSettings,
              animated: settings.animated
            }
          }
        })

        elementAnimations.set('__animator__', animatedElement)
      }

      animations.set(element, elementAnimations)
    }

    if (!element.parentNode) {
      parent.appendChild(element)
    }
  }
}

export { renderFrameElements }
