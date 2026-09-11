import { type ReactNode } from 'react'
import { Animator, Animated, cx, memo, styleFrameClipOctagon } from '@arwes/react'
import { Heart, Github, X, Discord } from 'iconoir-react'
import { Link } from '@/router'

import { theme } from '@/config'

type MobileLinkProps = {
  className?: string
  href: string
  target: string
  children: ReactNode
}

const MobileLink = memo((props: MobileLinkProps): JSX.Element => {
  const { className, href, target, children } = props
  return (
    <Animator>
      <Animated
        className={cx(
          'flex-1 overflow-hidden flex',
          'transition-all ease-out duration-200',
          'bg-primary-main-3/[0.05] hover:bg-primary-main-3/[0.10]',
          className
        )}
        style={{
          clipPath: styleFrameClipOctagon({ squareSize: theme.space(2) })
        }}
        animated={['flicker']}
      >
        <Link
          className="flex-1 flex justify-center items-center p-2 text-size-5 text-primary-main-3"
          href={href}
          target={target}
        >
          {children}
        </Link>
      </Animated>
    </Animator>
  )
})

type MobileLinksProps = {
  className?: string
}

const MobileLinks = memo((props: MobileLinksProps): JSX.Element => {
  const { className } = props
  return (
    <div className={cx('flex flex-row justify-between items-center gap-2', className)}>
      <MobileLink href="https://github.com/sponsors/romelperez" target="sponsor">
        <Heart />
      </MobileLink>
      <MobileLink href="https://github.com/arwes/arwes" target="github">
        <Github />
      </MobileLink>
      <MobileLink href="https://x.com/arwesjs" target="x">
        <X />
      </MobileLink>
      <MobileLink href="https://discord.gg/s5sbTkw" target="discord">
        <Discord />
      </MobileLink>
    </div>
  )
})

export { MobileLinks }
