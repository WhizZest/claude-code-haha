import { useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  code: string
  language?: string
  maxLines?: number
  showLineNumbers?: boolean
}

export function CodeViewer({ code, language, maxLines = 20, showLineNumbers = true }: Props) {
  const [expanded, setExpanded] = useState(false)

  const allLines = code.split('\n')
  const isTruncated = !expanded && allLines.length > maxLines
  const visibleCode = isTruncated ? allLines.slice(0, maxLines).join('\n') : code

  const effectiveShowLineNumbers = showLineNumbers && !!language && language !== 'text'
  const languageLabel = language || 'code'
  const lineCountLabel = `${allLines.length} ${allLines.length === 1 ? 'line' : 'lines'}`
  const showExpandToggle = allLines.length > maxLines

  return (
    <div className="overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
      <div className="flex items-center justify-between border-b border-[#d0d7de] bg-white px-3 py-1.5 text-[11px] text-[#57606a]">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-[0.14em] text-[#57606a]">{languageLabel}</span>
          <span>{lineCountLabel}</span>
        </div>
        <CopyButton
          text={code}
          className="rounded-md border border-[#d0d7de] bg-white px-2 py-1 text-[11px] text-[#57606a] transition-colors hover:bg-[#f3f4f6] hover:text-[#24292f]"
        />
      </div>

      <div className="max-h-[420px] overflow-auto">
        <Highlight theme={themes.github} code={visibleCode} language={language || 'text'}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="m-0 bg-white p-0 font-[var(--font-mono)] text-[12px] leading-[1.3]">
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line })
                const hasLanguage = !!language && language !== 'text'
                return effectiveShowLineNumbers ? (
                  <div
                    key={i}
                    {...lineProps}
                    className="grid grid-cols-[3rem,minmax(0,1fr)] gap-0 hover:bg-[#f6f8fa]/50"
                    style={undefined}
                  >
                    <span className="select-none border-r border-[#eaeef2] bg-[#fafbfc] px-2 py-px text-right text-[11px] text-[#8b949e]">
                      {i + 1}
                    </span>
                    <span className="overflow-hidden px-3 py-px whitespace-pre-wrap break-words">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                ) : (
                  <div
                    key={i}
                    {...lineProps}
                    className="hover:bg-[#f6f8fa]/50"
                    style={undefined}
                  >
                    <span className={`block px-3 py-px whitespace-pre-wrap break-words ${!hasLanguage ? 'text-[#24292f]' : ''}`}>
                      {hasLanguage ? (
                        line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))
                      ) : (
                        line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} style={{ color: '#24292f' }} />
                        ))
                      )}
                    </span>
                  </div>
                )
              })}
            </pre>
          )}
        </Highlight>
      </div>

      {showExpandToggle && (
        <button
          onClick={() => setExpanded((value) => !value)}
          className="w-full border-t border-[#d0d7de] bg-[#f6f8fa] py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#57606a] transition-colors hover:bg-[#eaeef2] hover:text-[#24292f]"
        >
          {expanded ? 'Collapse' : `Show ${allLines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  )
}
