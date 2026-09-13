export interface LogoData {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'dark'
  showText?: boolean
  showVersion?: boolean
  version?: string
  className?: string
  href?: string // Optional link URL
}

const sizeClasses = {
  sm: 'h-6 w-auto',
  md: 'h-8 w-auto',
  lg: 'h-12 w-auto',
  xl: 'h-16 w-auto'
}

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl'
}

/**
 * The name the admin introduces itself with. It is the CMS's own name, not the
 * `siteName` setting (which names the site the content belongs to), so the wordmark
 * reads the same everywhere it is rendered.
 */
const BRAND_NAME = 'Sci-Fi'
const BRAND_SUFFIX = 'CMS'

export function renderLogo(data: LogoData = {}): string {
  const {
    size = 'md',
    variant = 'default',
    showText = true,
    showVersion = true,
    version,
    className = '',
    href
  } = data

  const sizeClass = sizeClasses[size]
  const textSizeClass = textSizeClasses[size]

  // Color mapping for variants
  const textColor =
    variant === 'white' ? 'currentColor' : variant === 'dark' ? '#1f2937' : 'currentColor'
  const sparkColor = '#f6821f'

  // The mark: a frame with a lit core inside. Drawn rather than lettered, so it
  // stays crisp at every size and needs no font.
  const logoSvg = `
    <svg class="${sizeClass} ${className}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.9 21.1 7.05v10.1L12 22.3 2.9 17.15V7.05z" stroke="${textColor}" stroke-width="1.3" stroke-linejoin="round" opacity="0.55"/>
      <path d="M12 6.1 17 8.95v5.7L12 17.5 7 14.65v-5.7z" fill="${sparkColor}"/>
      <path d="M12 9.4 14.5 10.85v2.9L12 15.2 9.5 13.75v-2.9z" fill="${textColor}"/>
    </svg>
  `

  // The wordmark is set in text: it is the product's name, and keeping it out of
  // the artwork means it follows the interface's font and colour.
  const wordmark = `
    <span class="font-semibold leading-none tracking-tight whitespace-nowrap ${textSizeClass}" style="color: inherit">
      ${BRAND_NAME}<span style="color: ${sparkColor}">${BRAND_SUFFIX}</span>
    </span>
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

  const logoContent = showText
    ? `
    <div class="flex items-center gap-2 ${className}">
      ${logoSvg}
      ${wordmark}
      ${versionBadge}
    </div>
  `
    : logoSvg

  // Wrap in link if href is provided
  if (href) {
    return `<a href="${href}" class="inline-block hover:opacity-80 transition-opacity" style="color: inherit">${logoContent}</a>`
  }

  return logoContent
}
