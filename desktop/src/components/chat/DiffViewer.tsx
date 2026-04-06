import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { Highlight, themes } from 'prism-react-renderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  filePath: string
  oldString: string
  newString: string
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', rb: 'ruby',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', css: 'css', html: 'markup', xml: 'markup',
    sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
  }
  return langMap[ext ?? ''] || 'text'
}

function highlightSyntax(str: string, language: string) {
  return (
    <Highlight theme={themes.github} code={str} language={language}>
      {({ tokens, getTokenProps }) => (
        <>
          {tokens.map((line, i) => (
            <span key={i}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </span>
          ))}
        </>
      )}
    </Highlight>
  )
}

const diffStyles = {
  variables: {
    light: {
      diffViewerBackground: '#ffffff',
      diffViewerColor: '#24292f',
      addedBackground: '#dafbe1',
      addedColor: '#24292f',
      removedBackground: '#ffebe9',
      removedColor: '#24292f',
      wordAddedBackground: '#abf2bc',
      wordRemovedBackground: '#ff818266',
      addedGutterBackground: '#ccffd8',
      removedGutterBackground: '#ffd7d5',
      gutterBackground: '#f6f8fa',
      gutterBackgroundDark: '#f0f1f3',
      highlightBackground: '#fffbdd',
      highlightGutterBackground: '#fff5b1',
      codeFoldGutterBackground: '#dbedff',
      codeFoldBackground: '#f1f8ff',
      emptyLineBackground: '#fafbfc',
      gutterColor: '#8b949e',
      addedGutterColor: '#1a7f37',
      removedGutterColor: '#cf222e',
      codeFoldContentColor: '#57606a',
      diffViewerTitleBackground: '#fafbfc',
      diffViewerTitleColor: '#57606a',
      diffViewerTitleBorderColor: '#d0d7de',
    },
  },
  diffContainer: {
    borderRadius: '0',
    fontSize: '12px',
    lineHeight: '1.3',
    fontFamily: 'var(--font-mono)',
  },
  line: {
    padding: '1px 0',
  },
  gutter: {
    padding: '1px 8px',
    minWidth: '40px',
    fontSize: '11px',
  },
  wordDiff: {
    padding: '1px 2px',
    borderRadius: '2px',
  },
}

export function DiffViewer({ filePath, oldString, newString }: Props) {
  const language = inferLanguage(filePath)

  const oldLines = oldString.split('\n')
  const newLines = newString.split('\n')
  const additions = newLines.filter((l, i) => l !== (oldLines[i] ?? null)).length
  const deletions = oldLines.filter((l, i) => l !== (newLines[i] ?? null)).length

  return (
    <div className="overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
      <div className="flex items-center justify-between border-b border-[#d0d7de] bg-white px-3 py-1.5">
        <div className="min-w-0">
          <div className="truncate font-[var(--font-mono)] text-[11px] text-[#57606a]">
            {filePath}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
            <span className="rounded-full bg-[#dafbe1] px-2 py-0.5 text-[#1a7f37]">+{additions}</span>
            <span className="rounded-full bg-[#ffebe9] px-2 py-0.5 text-[#cf222e]">-{deletions}</span>
          </div>
        </div>
        <CopyButton
          text={`--- ${filePath}\n+++ ${filePath}`}
          label="Copy path"
          className="rounded-md border border-[#d0d7de] bg-white px-2 py-1 text-[11px] text-[#57606a] transition-colors hover:bg-[#f3f4f6] hover:text-[#24292f]"
        />
      </div>

      <div className="max-h-[400px] overflow-auto">
        <ReactDiffViewer
          oldValue={oldString}
          newValue={newString}
          splitView={false}
          compareMethod={DiffMethod.WORDS}
          renderContent={(str) => highlightSyntax(str, language)}
          hideLineNumbers={false}
          styles={diffStyles}
          useDarkTheme={false}
        />
      </div>
    </div>
  )
}
