import { renderLogo } from './packages/core/src/templates/components/logo.template.ts'
const html = renderLogo({ size: 'md', variant: 'white', showText: true })
console.log(html.replace(/\n\s*/g, ' ').trim().slice(0, 420))