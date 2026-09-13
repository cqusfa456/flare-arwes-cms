export interface LogoData {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
  showText?: boolean
  showVersion?: boolean
  version?: string
  className?: string
  href?: string // Optional link URL
}

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl'
}

/**
 * The name the admin introduces itself with. It is the CMS's own name, not the
 * `siteName` setting (which names the site the content belongs to), so the brand
 * reads the same everywhere it is rendered.
 */
const BRAND_NAME = 'Sci-Fi'
const BRAND_SUFFIX = 'CMS'

/**
 * The admin's brand: the name, set in the interface's own font.
 *
 * It is words rather than artwork, so it follows the theme's colour and stays crisp
 * at every size. `size` picks the type size; the version badge is optional.
 */
export function renderLogo(data: LogoData = {}): string {
  const { size = 'md', variant = 'default', showVersion = true, version, className = '', href } = data

  const textSizeClass = textSizeClasses[size]

  // Colour mapping for variants; the suffix keeps the brand accent either way.
  const textColor =
    variant === 'white' ? 'currentColor' : variant === 'dark' ? '#1f2937' : 'currentColor'
  const accentColor = '#f6821f'

  const wordmark = `
    <span class="font-semibold leading-none tracking-tight whitespace-nowrap ${textSizeClass} ${className}" style="color: ${textColor}"
      >${BRAND_NAME}&nbsp;<span style="color: ${accentColor}">${BRAND_SUFFIX}</span></span
    >
  `

  const versionBadge =
    showVersion && version
      ? `
    <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset cursor-pointer select-none ${
      variant === 'white'
        ? 'bg-white/10 text-white/80 ring-white/20 hover:bg-white/20'
        : 'bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20'
    }" onclick="navigator.clipboard.writeText('${version}').then(()=>{this.dataset.orig=this.textContent;this.textContent='Copied!';setTimeout(()=>{this.textContent=this.dataset.orig},1500)})" title="Click to copy">
      ${version}
    </span>
  `
      : ''

  const logoContent = `
    <div class="flex items-center gap-2">
      ${wordmark}
      ${versionBadge}
    </div>
  `

  // Wrap in link if href is provided
  if (href) {
    return `<a href="${href}" class="inline-block hover:opacity-80 transition-opacity" style="color: inherit">${logoContent}</a>`
  }

  return logoContent
}
