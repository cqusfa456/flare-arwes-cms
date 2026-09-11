import {
  type ReactNode,
  type ReactElement,
  type HTMLProps,
  type ForwardedRef,
  type CSSProperties,
  createElement,
  useMemo,
  useState,
  useRef,
  useEffect
} from 'react'
import { cx } from '@arwes/tools'
import { memo, mergeRefs } from '@arwes/react-tools'
import type { Easing, Animation } from '@arwes/animated'
import { useAnimator } from '@arwes/react-animator'
import {
  type AnimateTextManager,
  getAnimationTextDuration,
  animateTextSequence,
  animateTextDecipher
} from '@arwes/text'

interface TextProps<E extends HTMLElement = HTMLSpanElement> extends HTMLProps<E> {
  as?: keyof HTMLElementTagNameMap
  className?: string
  contentClassName?: string
  contentStyle?: CSSProperties
  elementRef?: ForwardedRef<E>
  manager?: AnimateTextManager
  easing?: Easing
  /**
   * If the duration of the animation should be fixed by the parent Animator
   * or dynamic according to its children.
   */
  fixed?: boolean
  /**
   * In manager sequence, add a blinking element at the end of the currently
   * displayed text.
   */
  blink?: boolean
  blinkDuration?: number
  characters?: string
  hideOnEntered?: boolean
  hideOnExited?: boolean
  children: ReactNode
}

const Text = memo(<E extends HTMLElement = HTMLSpanElement>(props: TextProps<E>): ReactElement => {
  const {
    as: asProvided = 'p',
    className,
    contentClassName,
    contentStyle,
    children,
    manager,
    easing,
    fixed,
    blink,
    blinkDuration,
    characters,
    hideOnEntered,
    hideOnExited = true,
    elementRef: elementRefProvided,
    ...otherProps
  } = props

  const as = useMemo(() => asProvided, [])
  const [childrenText, setChildrenText] = useState('')
  const elementRef = useRef<E>(null)
  const contentElementRef = useRef<HTMLSpanElement>(null)
  const transitionControl = useRef<Animation | null>(null)
  const animator = useAnimator()

  useEffect(() => {
    setChildrenText(contentElementRef.current?.textContent ?? '')
  }, [children])

  useEffect(() => {
    const rootElement = elementRef.current
    const contentElement = contentElementRef.current

    if (!animator || !childrenText.length || !rootElement || !contentElement) {
      return
    }

    if (!fixed) {
      const { settings } = animator.node
      const durationEnter = getAnimationTextDuration({
        length: childrenText.length,
        maxDuration: settings.duration.enter
      })
      const durationExit = getAnimationTextDuration({
        length: childrenText.length,
        maxDuration: settings.duration.exit
      })

      animator.node.control.setSettings({
        duration: { enter: durationEnter, exit: durationExit }
      })
    }

    const transition = (duration: number, isEntering: boolean): void => {
      const baseOptions = {
        rootElement,
        contentElement,
        duration,
        isEntering,
        easing,
        hideOnExited,
        hideOnEntered
      }

      transitionControl.current?.cancel()
      if (manager === 'decipher') {
        transitionControl.current = animateTextDecipher({ ...baseOptions, characters })
      } else {
        transitionControl.current = animateTextSequence({ ...baseOptions, blink, blinkDuration })
      }
    }

    const unsubscribe = animator.node.subscribe((node) => {
      switch (node.state) {
        case 'entering': {
          transition(node.settings.duration.enter, true)
          break
        }
        case 'entered': {
          // If the node is subscribed when the state is entered right away,
          // then there was not an initial animation of entering, so run animations.
          if (!transitionControl.current) {
            transition(node.settings.duration.enter, true)
          }
          break
        }
        case 'exiting': {
          transition(node.settings.duration.exit, false)
          break
        }
      }
    })

    return () => {
      unsubscribe()
      transitionControl.current?.cancel()
      transitionControl.current = null
    }
  }, [animator, childrenText])

  return createElement(
    as,
    {
      ...otherProps,
      className: cx('arwes-text-text', className),
      style: {
        position: 'relative',
        ...otherProps.style
      },
      ref: mergeRefs<E>(elementRefProvided, elementRef)
    },
    createElement(
      'span',
      {
        ref: contentElementRef,
        className: cx('arwes-text-text__content', contentClassName),
        style: {
          position: 'relative',
          visibility: animator
            ? (animator.node.state === 'exited' && hideOnExited) ||
              (animator.node.state === 'entered' && hideOnEntered)
              ? 'hidden'
              : ''
            : undefined,
          ...contentStyle
        }
      },
      children
    )
  )
})

export type { TextProps }
export { Text }
