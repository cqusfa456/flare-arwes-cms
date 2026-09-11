import { settings } from '@/config/settings'

// All the routes of the app. Used by the Astro static generation and by
// the client-side router to know which paths are internal.
const routes = [
  '/',
  '/demos',
  '/docs',
  '/docs/design',
  '/docs/develop',
  '/docs/develop/fundamentals',
  '/docs/develop/fundamentals/visual',
  '/docs/develop/fundamentals/motion',
  '/docs/develop/fundamentals/audio',
  '/docs/develop/fundamentals/text',
  '/docs/develop/fundamentals/frames',
  '/docs/develop/fundamentals/bgs',
  '/docs/develop/vanilla',
  '/docs/develop/tailwind',
  '/docs/develop/react',
  '/docs/develop/react/animators',
  '/docs/develop/react/bleeps',
  '/docs/develop/react/text',
  '/docs/develop/react/frames',
  '/docs/develop/react/bgs',
  '/docs/develop/solid',
  '/docs/develop/svelte',
  '/docs/community',
  '/docs/community/apps',
  '/docs/community/similars'
] as const

type Route = (typeof routes)[number]

const isRoute = (pathname: string): pathname is Route =>
  (routes as readonly string[]).includes(pathname)

// Page titles per route. Used by the Astro pages for the HTML `<title>`
// and by the client-side router to update it on navigation.
const titles: Record<Route, string> = {
  '/': settings.title,
  '/demos': `Demos | ${settings.title}`,
  '/docs': `Documentation | ${settings.title}`,
  '/docs/design': `Design | ${settings.title}`,
  '/docs/develop': `Develop | ${settings.title}`,
  '/docs/develop/fundamentals': `Fundamentals | ${settings.title}`,
  '/docs/develop/fundamentals/visual': `Visual Fundamentals | ${settings.title}`,
  '/docs/develop/fundamentals/motion': `Motion Fundamentals | ${settings.title}`,
  '/docs/develop/fundamentals/audio': `Audio Fundamentals | ${settings.title}`,
  '/docs/develop/fundamentals/text': `Text Fundamentals | ${settings.title}`,
  '/docs/develop/fundamentals/frames': `Frames Fundamentals | ${settings.title}`,
  '/docs/develop/fundamentals/bgs': `Background Fundamentals | ${settings.title}`,
  '/docs/develop/vanilla': `Vanilla | ${settings.title}`,
  '/docs/develop/tailwind': `Tailwind | ${settings.title}`,
  '/docs/develop/react': `React | ${settings.title}`,
  '/docs/develop/react/animators': `React Animators | ${settings.title}`,
  '/docs/develop/react/bleeps': `React Bleeps | ${settings.title}`,
  '/docs/develop/react/text': `React Text | ${settings.title}`,
  '/docs/develop/react/frames': `React Frames | ${settings.title}`,
  '/docs/develop/react/bgs': `React Backgrounds | ${settings.title}`,
  '/docs/develop/solid': `Solid | ${settings.title}`,
  '/docs/develop/svelte': `Svelte | ${settings.title}`,
  '/docs/community': `Community | ${settings.title}`,
  '/docs/community/apps': `Community Apps | ${settings.title}`,
  '/docs/community/similars': `Community Similars | ${settings.title}`
}

const getTitle = (pathname: string): string =>
  isRoute(pathname) ? titles[pathname] : `Not Found | ${settings.title}`

export { routes, isRoute, getTitle }
export type { Route }
