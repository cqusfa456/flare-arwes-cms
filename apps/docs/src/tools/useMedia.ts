import { useEffect, useState } from 'react'

// 自包含的 useMedia hook（原生 matchMedia 实现）
// 替代 react-use 的 useMedia，避免 CJS/ESM 混合导入在 Astro SSR 下报错。
const getInitialState = (query: string, defaultState: boolean): boolean => {
  if (defaultState !== undefined) {
    return defaultState
  }
  if (typeof window !== 'undefined') {
    return window.matchMedia(query).matches
  }
  return false
}

const useMedia = (query: string, defaultState: boolean): boolean => {
  const [state, setState] = useState(() => getInitialState(query, defaultState))

  useEffect(() => {
    let mounted = true
    const mql = window.matchMedia(query)
    const onChange = (): void => {
      if (mounted) {
        setState(!!mql.matches)
      }
    }
    mql.addEventListener('change', onChange)
    setState(mql.matches)
    return () => {
      mounted = false
      mql.removeEventListener('change', onChange)
    }
  }, [query])

  return state
}

export { useMedia }
