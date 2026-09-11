'use client'

import { useEffect } from 'react'

import { usePathname } from '@/router'
import { getTitle } from '@/router/routes'

import { PageHome } from '@/app/PageHome'
import { PageDemos } from '@/app/demos/PageDemos'
import { PageDocs } from '@/app/docs/PageDocs'
import { PageDesign } from '@/app/docs/design/PageDesign'
import { LayoutDevelop } from '@/app/docs/develop/LayoutDevelop'
import { LayoutCommunity } from '@/app/docs/community/LayoutCommunity'
import { PageCommunity } from '@/app/docs/community/PageCommunity'
import { PageCommunityApps } from '@/app/docs/community/apps/PageCommunityApps'
import NotFound from '@/app/NotFound'

import DevelopContent from '@/app/docs/develop/Content'
import FundamentalsContent from '@/app/docs/develop/fundamentals/Content'
import VisualContent from '@/app/docs/develop/fundamentals/visual/Content'
import MotionContent from '@/app/docs/develop/fundamentals/motion/Content'
import AudioContent from '@/app/docs/develop/fundamentals/audio/Content'
import TextContent from '@/app/docs/develop/fundamentals/text/Content'
import FramesContent from '@/app/docs/develop/fundamentals/frames/Content'
import BgsContent from '@/app/docs/develop/fundamentals/bgs/Content'
import VanillaContent from '@/app/docs/develop/vanilla/Content'
import TailwindContent from '@/app/docs/develop/tailwind/Content'
import ReactContent from '@/app/docs/develop/react/Content'
import AnimatorsContent from '@/app/docs/develop/react/animators/Content'
import BleepsContent from '@/app/docs/develop/react/bleeps/Content'
import ReactTextContent from '@/app/docs/develop/react/text/Content'
import ReactFramesContent from '@/app/docs/develop/react/frames/Content'
import ReactBgsContent from '@/app/docs/develop/react/bgs/Content'
import SolidContent from '@/app/docs/develop/solid/Content'
import SvelteContent from '@/app/docs/develop/svelte/Content'
import SimilarsContent from '@/app/docs/community/similars/Content'

// The app root component. It renders the page component matching the
// current pathname. It is rendered inside the LayoutRoot which provides
// the ARWES animators, bleeps, and the global UI (header, background).
const App = (): JSX.Element => {
  const pathname = usePathname()

  // Update the document title on navigation.
  useEffect(() => {
    document.title = getTitle(pathname)
  }, [pathname])

  let content: JSX.Element

  if (pathname === '/') {
    content = <PageHome />
  } else if (pathname === '/demos') {
    content = <PageDemos />
  } else if (pathname === '/docs') {
    content = <PageDocs />
  } else if (pathname === '/docs/design') {
    content = <PageDesign />
  } else if (pathname.startsWith('/docs/develop')) {
    let page: JSX.Element

    switch (pathname) {
      case '/docs/develop':
        page = <DevelopContent />
        break
      case '/docs/develop/fundamentals':
        page = <FundamentalsContent />
        break
      case '/docs/develop/fundamentals/visual':
        page = <VisualContent />
        break
      case '/docs/develop/fundamentals/motion':
        page = <MotionContent />
        break
      case '/docs/develop/fundamentals/audio':
        page = <AudioContent />
        break
      case '/docs/develop/fundamentals/text':
        page = <TextContent />
        break
      case '/docs/develop/fundamentals/frames':
        page = <FramesContent />
        break
      case '/docs/develop/fundamentals/bgs':
        page = <BgsContent />
        break
      case '/docs/develop/vanilla':
        page = <VanillaContent />
        break
      case '/docs/develop/tailwind':
        page = <TailwindContent />
        break
      case '/docs/develop/react':
        page = <ReactContent />
        break
      case '/docs/develop/react/animators':
        page = <AnimatorsContent />
        break
      case '/docs/develop/react/bleeps':
        page = <BleepsContent />
        break
      case '/docs/develop/react/text':
        page = <ReactTextContent />
        break
      case '/docs/develop/react/frames':
        page = <ReactFramesContent />
        break
      case '/docs/develop/react/bgs':
        page = <ReactBgsContent />
        break
      case '/docs/develop/solid':
        page = <SolidContent />
        break
      case '/docs/develop/svelte':
        page = <SvelteContent />
        break
      default:
        page = <NotFound />
    }

    content = <LayoutDevelop>{page}</LayoutDevelop>
  } else if (pathname.startsWith('/docs/community')) {
    let page: JSX.Element

    switch (pathname) {
      case '/docs/community':
        page = <PageCommunity />
        break
      case '/docs/community/apps':
        page = <PageCommunityApps />
        break
      case '/docs/community/similars':
        page = <SimilarsContent />
        break
      default:
        page = <NotFound />
    }

    content = <LayoutCommunity>{page}</LayoutCommunity>
  } else {
    content = <NotFound />
  }

  return content
}

export { App }
