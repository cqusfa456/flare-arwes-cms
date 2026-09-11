import type {} from 'astro/client'

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
