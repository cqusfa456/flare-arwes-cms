import React, { useCallback, useState, type ReactNode } from 'react'
import { usePathname, Link } from '@/router'
import { useAtom } from 'jotai'
import {
  type AnimatedProp,
  Animated,
  Animator,
  styleFrameClipOctagon,
  cx,
  FrameOctagon,
  Illuminator,
  memo
} from '@arwes/react'
import {
  X,
  Page,
  Codepen,
  Settings,
  CollageFrame,
  DashboardSpeed,
  Github,
  Discord,
  Keyframes,
  KeyframesMinus,
  SoundHigh,
  SoundOff,
  Heart,
  Menu as MenuIcon,
  Post
} from 'iconoir-react'

import { atomAudioEnabled, atomMotionEnabled, settings, theme } from '@/config'
import { useAppBleeps, useAppBreakpoint } from '@/tools'
import { ArwesLogoIcon } from '../ArwesLogoIcon'
import { ArwesLogoType } from '../ArwesLogoType'
import { Menu } from '../Menu'
import { MenuItem } from '../MenuItem'
import { MobileMenu } from './MobileMenu'
import styles from './Header.module.css'

interface HeaderProps {
  className?: string
  animated?: AnimatedProp
  /** CMS blog path (its collection's URL prefix); undefined hides the link. */
  blogPath?: string
  /** Menu items from the CMS; empty means the built-in navigation is used. */
  navItems?: Array<{ label: string; href: string }>
  /**
   * The site's navigation bar, rendered from the CMS `nav` component by the site
   * layout. It is shown here, where the menu belongs, and takes precedence over
   * `navItems`.
   */
  navContent?: ReactNode
  /** Set when the page's layout renders the chrome: no menu from the shell. */
  hideMenu?: boolean
}

const HEIGHT_CLASS = 'h-10 md:h-12'

const Header = memo((props: HeaderProps): JSX.Element => {
  const { className, animated, blogPath, navItems, navContent, hideMenu } = props
  const hasCmsNav = !navContent && !!navItems && navItems.length > 0
  const hasNavContent = !!navContent

  const pathname = usePathname()
  const [isMotionEnabled, setIsMotionEnabled] = useAtom(atomMotionEnabled)
  const [isAudioEnabled, setIsAudioEnabled] = useAtom(atomAudioEnabled)
  const isMD = useAppBreakpoint('md')
  const isLG = useAppBreakpoint('lg')
  const isXL = useAppBreakpoint('xl')
  const bleeps = useAppBleeps()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const openMenu = useCallback(() => {
    setIsMenuOpen(true)
    bleeps.click?.play()
  }, [])
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false)
    bleeps.click?.play()
  }, [])

  const isIndex = pathname === '/'

  return (
    <Animated
      as="header"
      className={cx('flex justify-center items-center select-none', styles.root, className)}
      animated={animated}
    >
      <div className={cx('flex mx-auto p-2 w-full max-w-screen-3xl', 'md:px-4', 'xl:py-4')}>
        <div className={cx('relative flex-1 flex px-4')}>
          {/* BACKGROUND */}
          {!isIndex && (
            <Animator merge>
              <Animated
                role="presentation"
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: styleFrameClipOctagon({ squareSize: theme.space(2) })
                }}
                animated={['flicker']}
              >
                <FrameOctagon
                  style={{
                    // @ts-expect-error css variables
                    '--arwes-frames-bg-color': theme.colors.primary.main(9, { alpha: 0.1 }),
                    '--arwes-frames-line-color': theme.colors.primary.main(9, { alpha: 0.5 })
                  }}
                  squareSize={theme.spacen(2)}
                />
                {isXL && (
                  <Illuminator
                    color={theme.colors.primary.main(7, { alpha: 0.1 })}
                    size={theme.spacen(100)}
                  />
                )}
              </Animated>
            </Animator>
          )}

          {/* CONTENT */}
          <div className="relative flex-1 flex flex-row justify-between items-center">
            {/* LEFT PANEL */}
            <Animator combine manager="stagger" refreshOn={[isIndex, isMD]}>
              <Animated className="flex flex-row gap-4" animated={[['x', theme.spacen(4), 0, 0]]}>
                <Link className={styles.logo} href="/" onClick={() => bleeps.click?.play()}>
                  <h1
                    className={cx('flex flex-row justify-center items-center gap-2', HEIGHT_CLASS)}
                    title={settings.title}
                  >
                    <Animator>
                      <ArwesLogoIcon
                        className={cx('w-5 h-5 md:w-6 md:h-6', styles.logoImage)}
                        animated={['flicker']}
                      />
                    </Animator>

                    <Animator
                      merge
                      condition={!isIndex && isMD}
                      unmountOnExited
                      unmountOnDisabled={isIndex || !isMD}
                    >
                      <ArwesLogoType className="h-3 md:h-4" animated={['flicker']} />
                    </Animator>
                  </h1>
                </Link>

                <Animator
                  combine
                  manager="stagger"
                  // The front page hides the menu unless the CMS provides one for it:
                  // a site that manages its navigation decides what the home menu is.
                  condition={(!isIndex || hasCmsNav || hasNavContent) && !hideMenu}
                  unmountOnExited
                  unmountOnDisabled={(isIndex && !hasCmsNav && !hasNavContent) || !!hideMenu}
                >
                  {/*
                    The navigation bar is a CMS component (Admin → Content →
                    Components): the site layout passes it in and it sits here, in
                    the header, on every page. Without one, the menu is built from
                    the CMS `navigation` collection, and without that from the
                    site's own built-in navigation.
                  */}
                  {hasNavContent && (
                    <div
                      className={cx(
                        'flex flex-row items-center gap-2 overflow-x-auto',
                        HEIGHT_CLASS
                      )}
                    >
                      {navContent}
                    </div>
                  )}

                  {!hasNavContent && (
                    <Menu className={HEIGHT_CLASS}>
                      {hasCmsNav &&
                        navItems.map((item) => (
                          <Animator key={item.href}>
                            <MenuItem
                              active={
                                pathname === item.href.replace(/\/+$/, '') ||
                                pathname.startsWith(`${item.href.replace(/\/+$/, '')}/`)
                              }
                              animated={['flicker']}
                            >
                              <Link href={item.href} title={item.label}>
                                <span className="hidden md:block">{item.label}</span>
                              </Link>
                            </MenuItem>
                          </Animator>
                        ))}
                      {!hasCmsNav && (
                        <>
                          <Animator>
                            <MenuItem active={pathname.startsWith('/docs')} animated={['flicker']}>
                              <Link href="/docs" title="Go to Documentation">
                                <Page /> <span className="hidden md:block">Docs</span>
                              </Link>
                            </MenuItem>
                          </Animator>
                          {blogPath && (
                            <Animator>
                              {/*
                          The link carries the canonical trailing slash, while the
                          active state compares against the prefix itself: the
                          app's pathname never has a trailing slash.
                        */}
                              <MenuItem
                                active={
                                  pathname === blogPath.replace(/\/+$/, '') ||
                                  pathname.startsWith(`${blogPath.replace(/\/+$/, '')}/`)
                                }
                                animated={['flicker']}
                              >
                                <Link href={blogPath} title="Go to Blog">
                                  <Post /> <span className="hidden md:block">Blog</span>
                                </Link>
                              </MenuItem>
                            </Animator>
                          )}
                          <Animator>
                            <MenuItem active={pathname.startsWith('/demos')} animated={['flicker']}>
                              <Link href="/demos" title="Go to Demos">
                                <CollageFrame /> <span className="hidden md:block">Demos</span>
                              </Link>
                            </MenuItem>
                          </Animator>
                          {settings.apps.play.url && (
                            <Animator>
                              <MenuItem
                                active={pathname.startsWith('/play')}
                                animated={['flicker']}
                              >
                                <a href={settings.apps.play.url} title="Go to Playground">
                                  <Codepen /> <span className="hidden md:block">Play</span>
                                </a>
                              </MenuItem>
                            </Animator>
                          )}
                          {settings.apps.perf.url && (
                            <Animator>
                              <MenuItem
                                active={pathname.startsWith('/perf')}
                                animated={['flicker']}
                              >
                                <a href={settings.apps.perf.url} title="Go to Performance">
                                  <DashboardSpeed /> <span className="hidden md:block">Perf</span>
                                </a>
                              </MenuItem>
                            </Animator>
                          )}
                        </>
                      )}
                    </Menu>
                  )}
                </Animator>
              </Animated>
            </Animator>

            {/* RIGHT PANEL */}
            <Animator combine manager="switch" refreshOn={[isLG]}>
              <Animator
                combine
                manager="staggerReverse"
                condition={!isLG}
                unmountOnExited
                unmountOnDisabled={isLG}
              >
                <Animated
                  as="nav"
                  className="flex flex-row gap-4"
                  animated={[['x', theme.spacen(-2), 0, 0]]}
                >
                  <Menu className={HEIGHT_CLASS}>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <button>
                          <Settings />
                        </button>
                      </MenuItem>
                    </Animator>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <button onClick={openMenu}>
                          <MenuIcon />
                        </button>
                      </MenuItem>
                    </Animator>
                  </Menu>
                </Animated>
              </Animator>

              <Animator
                combine
                manager="staggerReverse"
                condition={isLG}
                unmountOnExited
                unmountOnDisabled={!isLG}
              >
                <Animated
                  as="nav"
                  className="flex flex-row gap-4"
                  animated={[['x', theme.spacen(-4), 0, 0]]}
                >
                  <Menu className={HEIGHT_CLASS}>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <a
                          className="normal-case"
                          href={`https://github.com/arwes/arwes/releases/tag/v${settings.version}`}
                          target="version"
                          title={new Date(settings.deployTime).toString()}
                        >
                          v{settings.version}
                        </a>
                      </MenuItem>
                    </Animator>
                  </Menu>
                  <Menu className={HEIGHT_CLASS}>
                    <Animator>
                      <MenuItem className="group hover:!text-fuchsia-300" animated={['flicker']}>
                        <a
                          className="!gap-0 group-hover:text-fuchsia-300"
                          href="https://github.com/sponsors/romelperez"
                          target="sponsor"
                        >
                          <Heart />
                          <div
                            className={cx(
                              'grid grid-flow-row grid-cols-[0fr]',
                              'transition-all ease-out duration-200',
                              'group-hover:grid-cols-[1fr] group-hover:pl-2'
                            )}
                          >
                            <div className="overflow-hidden">Sponsor</div>
                          </div>
                        </a>
                      </MenuItem>
                    </Animator>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <a
                          href="https://github.com/arwes/arwes"
                          target="github"
                          title="Go to Github"
                        >
                          <Github />
                        </a>
                      </MenuItem>
                    </Animator>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <a href="https://x.com/arwesjs" target="twitter" title="Go to X (Twitter)">
                          <X />
                        </a>
                      </MenuItem>
                    </Animator>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <a href="https://discord.gg/s5sbTkw" target="discord" title="Go to Discord">
                          <Discord />
                        </a>
                      </MenuItem>
                    </Animator>
                  </Menu>

                  <Menu className={HEIGHT_CLASS}>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <button
                          title={isMotionEnabled ? 'Disable motion' : 'Enable motion'}
                          onClick={() => setIsMotionEnabled(!isMotionEnabled)}
                        >
                          {isMotionEnabled ? <Keyframes /> : <KeyframesMinus />}
                        </button>
                      </MenuItem>
                    </Animator>
                    <Animator>
                      <MenuItem animated={['flicker']}>
                        <button
                          title={isAudioEnabled ? 'Disable audio' : 'Enable audio'}
                          onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                        >
                          {isAudioEnabled ? <SoundHigh /> : <SoundOff />}
                        </button>
                      </MenuItem>
                    </Animator>
                  </Menu>
                </Animated>
              </Animator>
            </Animator>
          </div>
        </div>
      </div>

      {/* MOBILE MENU */}
      <MobileMenu isMenuOpen={isMenuOpen} closeMenu={closeMenu} blogPath={blogPath} />
    </Animated>
  )
})

export { Header }
