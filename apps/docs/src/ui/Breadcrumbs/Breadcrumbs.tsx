import { Fragment } from 'react'
import { cx, type AnimatedProp, Animated } from '@arwes/react'
import { FastArrowRight } from 'iconoir-react'
import { Link } from '@/router'

type BreadcrumbsProps = {
  className?: string
  animated?: AnimatedProp
  items: Array<{ text: React.ReactNode; href?: string }>
}

const Breadcrumbs = (props: BreadcrumbsProps): JSX.Element => {
  const { className, animated, items } = props

  return (
    <Animated
      as="nav"
      className={cx(
        'flex flex-row items-center gap-2',
        'not-prose text-size-10',
        'lg:text-size-9',
        className
      )}
      animated={animated}
    >
      {items.map(({ href, text }, index) => {
        const prevSeparator = <FastArrowRight className="text-primary-low-3" />
        const nextSeparator = index === items.length - 1 && (
          <FastArrowRight className="text-primary-low-3" />
        )

        if (href) {
          return (
            <Fragment key={href}>
              {prevSeparator}
              <Link
                className="flex flex-row items-center gap-1 text-secondary-low-2 hover:text-secondary-high-2"
                href={href}
              >
                {text}
              </Link>
              {nextSeparator}
            </Fragment>
          )
        }

        return (
          <Fragment key={href}>
            {prevSeparator}
            <div className="flex flex-row items-center gap-1 text-primary-low-3">{text}</div>
            {nextSeparator}
          </Fragment>
        )
      })}
    </Animated>
  )
}

export type { BreadcrumbsProps }
export { Breadcrumbs }
