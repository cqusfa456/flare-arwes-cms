import { Animated, type AnimatedProp, cx, Animator, memo } from '@arwes/react'
import { Highlight, themes } from 'prism-react-renderer'

import { theme } from '@/config'

type CodeBlockProps = {
  className?: string
  animated?: AnimatedProp
  filename?: string
  lang?: 'html' | 'css' | 'tsx' | 'json' | 'bash'
  highlightLines?: number[]
  code: string
}

const CodeBlock = memo((props: CodeBlockProps): JSX.Element => {
  const { className, animated, filename, lang = 'tsx', code, highlightLines } = props

  return (
    <Animated data-name="codeblock" className={cx('flex flex-col', className)} animated={animated}>
      {filename && (
        <Animator>
          <Animated
            className={cx(
              'flex flex-row justify-between items-center gap-4 border-b px-4 py-2',
              'font-code leading-none',
              'border-primary-main-7 text-primary-main-4 bg-primary-main-5/10'
            )}
            animated={['flicker']}
          >
            {filename}
          </Animated>
        </Animator>
      )}
      <Animator>
        <Animated animated={['flicker']}>
          <Highlight theme={themes.vsDark} code={code} language={lang}>
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={className}
                style={{
                  ...style,
                  display: 'flex',
                  flexDirection: 'column',
                  margin: 0,
                  fontFamily: theme.fontFamily.code.join(),
                  fontWeight: 400,
                  borderRadius: '0',
                  background: theme.colors.primary.main(9, { alpha: 0.1 })
                }}
              >
                {tokens.map((line, i) => {
                  const lineProps = getLineProps({ line })
                  const isHighlighted = highlightLines && highlightLines.includes(i + 1)
                  return (
                    <div
                      key={i}
                      {...lineProps}
                      className={cx(
                        lineProps.className,
                        'mr-auto',
                        isHighlighted && 'bg-secondary-main-9/50'
                      )}
                    >
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  )
                })}
              </pre>
            )}
          </Highlight>
        </Animated>
      </Animator>
    </Animated>
  )
})

export type { CodeBlockProps }
export { CodeBlock }
