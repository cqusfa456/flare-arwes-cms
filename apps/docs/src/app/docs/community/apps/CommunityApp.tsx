import { useRef } from 'react'
import {
  Animated,
  Animator,
  FrameNero,
  FrameOctagon,
  cx,
  memo,
  styleFrameClipOctagon
} from '@arwes/react'
import { Calendar, WarningTriangle } from 'iconoir-react'

import { theme } from '@/config'
import { useAppBleeps, useAppBreakpoint } from '@/tools'
import styles from './CommunityApp.module.css'

type CommunityAppProps = {
  className?: string
  url: string
  imageURL: string
  videoURL?: string
  repositoryURL?: string
  title: string
  isOutdated?: boolean
  isExperimental?: boolean
  children: string
}

const CommunityApp = memo((props: CommunityAppProps): JSX.Element => {
  const {
    className,
    url,
    imageURL,
    videoURL,
    repositoryURL,
    title,
    isOutdated,
    isExperimental,
    children
  } = props

  const videoRef = useRef<HTMLVideoElement>(null)
  const bleeps = useAppBleeps()
  const isMD = useAppBreakpoint('md')

  return (
    <Animator duration={{ enter: 0.8 }}>
      <Animated
        as="article"
        className={cx('relative flex flex-col', styles.root, className)}
        style={{
          background: 'var(--arwes-frames-bg-color)',
          clipPath: styleFrameClipOctagon({
            leftBottom: false,
            rightTop: false,
            squareSize: theme.spacen(4)
          })
        }}
        animated={['fade', ['y', '1rem', 0]]}
        onMouseEnter={() => {
          void videoRef.current?.play()
        }}
        onMouseLeave={() => {
          void videoRef.current?.pause()
        }}
      >
        <div className="relative w-full pb-[60%] select-none">
          {videoURL && (
            <video
              ref={videoRef}
              className="absolute inset-0 size-full object-cover object-center"
              preload="none"
              muted
              loop
              poster={`/assets/community/apps/media/${imageURL}`}
              onClick={(event) => {
                event.currentTarget.currentTime = 0
                void event.currentTarget.play()
                bleeps.click?.play()
              }}
            >
              <source src={`/assets/community/apps/media/${videoURL}`} type="video/webm"></source>
            </video>
          )}

          {!videoURL && (
            <img
              className="absolute inset-0 size-full object-cover"
              src={`/assets/community/apps/media/${imageURL}`}
              loading="lazy"
            />
          )}

          <div className="absolute bottom-0 left-2 flex flex-row text-size-10 leading-none font-body empty:hidden">
            {isOutdated && (
              <div
                className="flex flex-row gap-1 px-2 py-1 text-error-5 bg-error-12"
                title="The project was built with a previous or outdated version of the framework"
              >
                <Calendar /> Outdated
              </div>
            )}
            {isExperimental && (
              <div
                className="flex flex-row gap-1 px-2 py-1 text-error-5 bg-error-12"
                title="The project was an experiment for ARWES functionalities and does not directly contain the packages"
              >
                <WarningTriangle /> Experimental
              </div>
            )}
          </div>
        </div>

        <FrameOctagon
          className="pointer-events-none"
          leftBottom={false}
          rightTop={false}
          squareSize={theme.spacen(4)}
        />

        <FrameNero className="pointer-events-none" animated={!isMD} />

        <div className="relative flex-1 flex flex-col gap-2 p-4">
          <a
            className="text-size-7 font-header text-primary-main-3 hover:text-primary-high-2"
            href={url}
            target="_blank"
            onClick={() => bleeps.click?.play()}
          >
            <h1>{title}</h1>
          </a>

          {repositoryURL && (
            <a
              className="text-size-9 font-body text-primary-main-5 hover:text-primary-high-4"
              href={repositoryURL}
              target="_blank"
              title="Source code repository"
              onClick={() => bleeps.click?.play()}
            >
              <p>
                {repositoryURL.replace('https://github.com', '').replace('https://gitlab.com', '')}
              </p>
            </a>
          )}

          <p className="text-size-9 font-body text-primary-low-3">{children}</p>
        </div>
      </Animated>
    </Animator>
  )
})

export { CommunityApp }
