import { useEffect, useRef, useState } from 'react'
import { Animator, Text, FrameHeader, cx, memo } from '@arwes/react'

const CommunityHeader = memo((): JSX.Element => {
  const headingRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)

  useEffect(() => {
    const heading = headingRef.current
    if (!heading) {
      return
    }
    const observer = new ResizeObserver(() => setContentWidth(heading.offsetWidth))
    observer.observe(heading)
    return () => observer.disconnect()
  }, [])

  return (
    <Animator combine manager="stagger">
      <header className="relative flex flex-row items-center gap-2 pb-2 md:gap-4 md:pb-4">
        <Animator duration={{ enter: 0.8 }}>
          <FrameHeader contentLength={contentWidth} />
        </Animator>

        <Animator>
          <Text
            as="h1"
            elementRef={headingRef}
            className={cx(
              'text-size-4 leading-none font-header text-primary-main-4',
              'md:text-size-3',
              'xl:text-size-2'
            )}
            fixed
          >
            Community
          </Text>
        </Animator>
      </header>
    </Animator>
  )
})

export { CommunityHeader }
