export const isBrowser = (): boolean => typeof window !== 'undefined'

export const isBrowserSafari = (): boolean =>
  isBrowser() &&
  window.navigator.userAgent.includes('Safari') &&
  !window.navigator.userAgent.includes('Chrome')
