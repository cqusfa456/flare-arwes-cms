import useMediaPkg from 'react-use'

import { theme } from '@/config'
const { useMedia } = useMediaPkg

const useAppBreakpoint = (breakpoint: (typeof theme.breakpoints.breakpoints)[number]): boolean => {
  return useMedia(theme.breakpoints.up(breakpoint, { strip: true }), false)
}

export { useAppBreakpoint }
