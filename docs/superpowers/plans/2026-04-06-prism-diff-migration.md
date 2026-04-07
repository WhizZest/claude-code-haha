# Migrate to prism-react-renderer + react-diff-viewer-continued

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace highlight.js and hand-rolled DiffViewer with prism-react-renderer and react-diff-viewer-continued for GitHub-quality code blocks and diff rendering.

**Architecture:** (1) Install new deps and remove old ones, (2) Rewrite CodeViewer using prism-react-renderer's Highlight component with render props, (3) Rewrite DiffViewer using react-diff-viewer-continued with syntax highlighting via prism, (4) Update MarkdownRenderer to use a React-based code block instead of HTML strings, (5) Delete highlightCode.ts and hljs CSS.

**Tech Stack:** prism-react-renderer (Highlight + themes.github), react-diff-viewer-continued (ReactDiffViewer), React 18, Tailwind CSS 4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `desktop/package.json` | Add prism-react-renderer + react-diff-viewer-continued, remove highlight.js + diff |
| Rewrite | `desktop/src/components/chat/CodeViewer.tsx` | Pure React code blocks via prism-react-renderer |
| Rewrite | `desktop/src/components/chat/DiffViewer.tsx` | GitHub PR-style diffs via react-diff-viewer-continued |
| Rewrite | `desktop/src/components/markdown/MarkdownRenderer.tsx` | Use CodeViewer React component instead of HTML strings for code blocks |
| Delete | `desktop/src/components/chat/highlightCode.ts` | No longer needed |
| Modify | `desktop/src/theme/globals.css` | Remove .hljs-* CSS rules |

**Consumers that import these files (no changes needed to their code):**
- `ToolCallBlock.tsx` imports `CodeViewer` and `DiffViewer` — same Props interface, no changes
- `ToolResultBlock.tsx` imports `CodeViewer` — same Props interface, no changes
- `PermissionDialog.tsx` imports `DiffViewer` — same Props interface, no changes

---

### Task 1: Install dependencies

**Files:**
- Modify: `desktop/package.json`

- [ ] **Step 1: Install new dependencies**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm install prism-react-renderer react-diff-viewer-continued
```

- [ ] **Step 2: Remove old dependencies**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm uninstall highlight.js @types/diff diff
```

Note: `diff` was only used by `DiffViewer.tsx`. `highlight.js` was only used by `CodeViewer.tsx` and `highlightCode.ts`.

- [ ] **Step 3: Verify no broken imports**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors about missing `highlight.js` and `diff` modules (since files still import them). This is fine — we fix those in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha && git add desktop/package.json desktop/package-lock.json && git commit -m "chore: add prism-react-renderer + react-diff-viewer-continued, remove highlight.js + diff"
```

---

### Task 2: Rewrite CodeViewer with prism-react-renderer

**Files:**
- Rewrite: `desktop/src/components/chat/CodeViewer.tsx`

- [ ] **Step 1: Replace the entire CodeViewer.tsx**

```tsx
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

  // Only show line numbers for known languages (actual code).
  // Plain text, file trees, command output look better without them.
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
                    <span className="block px-3 py-px whitespace-pre-wrap break-words">
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
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
```

Key changes:
- `highlight.js` replaced with `prism-react-renderer`'s `Highlight` component
- Pure React element rendering via `getTokenProps` — no `dangerouslySetInnerHTML`
- `themes.github` provides GitHub Light theme
- `language="text"` for unknown languages (no auto-detection, no colors)
- `style={undefined}` on line divs to prevent prism-react-renderer's default inline styles from overriding our Tailwind classes
- Same Props interface — all consumers (ToolCallBlock, ToolResultBlock) work unchanged

- [ ] **Step 2: Verify TypeScript compiles (may still fail on other files)**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npx tsc --noEmit 2>&1 | grep -v "highlightCode\|from 'diff'"
```

Expected: CodeViewer.tsx compiles without errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha && git add desktop/src/components/chat/CodeViewer.tsx && git commit -m "feat: rewrite CodeViewer with prism-react-renderer — pure React rendering, GitHub theme"
```

---

### Task 3: Rewrite DiffViewer with react-diff-viewer-continued

**Files:**
- Rewrite: `desktop/src/components/chat/DiffViewer.tsx`

- [ ] **Step 1: Replace the entire DiffViewer.tsx**

```tsx
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { Highlight, themes } from 'prism-react-renderer'
import { CopyButton } from '../shared/CopyButton'

type Props = {
  filePath: string
  oldString: string
  newString: string
}

/** Infer language from file extension for syntax highlighting within diffs */
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

/** Render a single line with prism syntax highlighting */
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

/** Custom styles to match our design system */
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

  // Count additions/deletions for the header
  const oldLines = oldString.split('\n')
  const newLines = newString.split('\n')
  const additions = newLines.filter((l, i) => l !== (oldLines[i] ?? null)).length
  const deletions = oldLines.filter((l, i) => l !== (newLines[i] ?? null)).length

  return (
    <div className="overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
      {/* Header */}
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

      {/* Diff body */}
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
```

Key changes:
- Removed hand-rolled `parsePatchLines()` and `createPatch` from `diff` library
- `react-diff-viewer-continued` handles all diffing, line numbering, and word-level highlighting
- `renderContent` prop integrates `prism-react-renderer` for syntax highlighting within diffs
- Same Props interface (`{ filePath, oldString, newString }`) — ToolCallBlock and PermissionDialog work unchanged
- Custom `diffStyles` matches our GitHub-light design tokens
- `inferLanguage()` extracts language from file extension for diff syntax coloring

- [ ] **Step 2: Commit**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha && git add desktop/src/components/chat/DiffViewer.tsx && git commit -m "feat: rewrite DiffViewer with react-diff-viewer-continued — GitHub PR-style diffs with syntax highlighting"
```

---

### Task 4: Rewrite MarkdownRenderer code blocks

**Files:**
- Rewrite: `desktop/src/components/markdown/MarkdownRenderer.tsx`

The current MarkdownRenderer generates code blocks as HTML strings via `marked`'s `renderer.code`. This has two problems: (1) uses `dangerouslySetInnerHTML` for code, (2) cannot use React components like prism-react-renderer inside HTML strings.

The solution: Use `marked`'s `renderer.code` to output a placeholder `<div data-codeblock="...">`, then post-process the HTML to replace those placeholders with React-rendered `CodeViewer` components.

- [ ] **Step 1: Replace the entire MarkdownRenderer.tsx**

```tsx
import { useMemo, useCallback } from 'react'
import { marked, type Tokens } from 'marked'
import { CodeViewer } from '../chat/CodeViewer'

type Props = {
  content: string
}

type CodeBlock = {
  id: string
  code: string
  language: string | undefined
}

// Unique marker that won't appear in normal markdown content
const CODEBLOCK_MARKER = '___CODEBLOCK___'

const renderer = new marked.Renderer()

// Collected code blocks during a single parse() call
let pendingCodeBlocks: CodeBlock[] = []

renderer.code = function ({ text, lang }: Tokens.Code) {
  const id = `cb-${pendingCodeBlocks.length}`
  pendingCodeBlocks.push({ id, code: text, language: lang || undefined })
  // Return a placeholder div that we'll replace with React components
  return `<div data-codeblock-id="${id}"></div>`
}

marked.setOptions({
  breaks: true,
  gfm: true,
})
marked.use({ renderer })

function parseMarkdown(content: string): { html: string; codeBlocks: CodeBlock[] } {
  pendingCodeBlocks = []
  const html = marked.parse(content) as string
  const codeBlocks = [...pendingCodeBlocks]
  pendingCodeBlocks = []
  return { html, codeBlocks }
}

export function MarkdownRenderer({ content }: Props) {
  const { html, codeBlocks } = useMemo(() => parseMarkdown(content), [content])

  // Split HTML at codeblock placeholders and interleave React components
  const parts = useMemo(() => {
    if (codeBlocks.length === 0) {
      return [{ type: 'html' as const, content: html }]
    }

    const result: Array<{ type: 'html'; content: string } | { type: 'code'; block: CodeBlock }> = []
    let remaining = html

    for (const block of codeBlocks) {
      const marker = `<div data-codeblock-id="${block.id}"></div>`
      const idx = remaining.indexOf(marker)
      if (idx === -1) continue

      const before = remaining.slice(0, idx)
      if (before) {
        result.push({ type: 'html', content: before })
      }
      result.push({ type: 'code', block })
      remaining = remaining.slice(idx + marker.length)
    }

    if (remaining) {
      result.push({ type: 'html', content: remaining })
    }

    return result
  }, [html, codeBlocks])

  const handleClick = useCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest<HTMLButtonElement>('[data-copy-code]')
    if (!button) return

    const text = button.getAttribute('data-copy-code')
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      const original = button.textContent
      button.textContent = 'Copied'
      window.setTimeout(() => {
        button.textContent = original
      }, 1500)
    } catch {
      // Ignore clipboard errors
    }
  }, [])

  const proseClasses = `prose prose-sm max-w-none text-[var(--color-text-primary)]
    prose-headings:text-[var(--color-text-primary)] prose-headings:font-semibold
    prose-p:my-2 prose-p:leading-relaxed
    prose-code:text-[13px] prose-code:font-[var(--font-mono)] prose-code:bg-[var(--color-surface-info)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
    prose-pre:!bg-transparent prose-pre:!p-0 prose-pre:!shadow-none
    prose-a:text-[var(--color-text-accent)] prose-a:no-underline hover:prose-a:underline
    prose-strong:text-[var(--color-text-primary)]
    prose-ul:my-2 prose-ol:my-2
    prose-li:my-0.5
    prose-table:text-sm
    prose-th:bg-[var(--color-surface-info)] prose-th:px-3 prose-th:py-2
    prose-td:px-3 prose-td:py-2 prose-td:border-[var(--color-border)]`

  // If no code blocks, render the simple way (same as before)
  if (codeBlocks.length === 0) {
    return (
      <div
        className={proseClasses}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />
    )
  }

  // Mixed content: interleave HTML fragments with React CodeViewer components
  return (
    <div className={proseClasses} onClick={handleClick}>
      {parts.map((part, i) =>
        part.type === 'html' ? (
          <div key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
        ) : (
          <div key={part.block.id} className="my-4">
            <CodeViewer
              code={part.block.code}
              language={part.block.language}
            />
          </div>
        )
      )}
    </div>
  )
}
```

Key changes:
- Code blocks are now rendered as React `CodeViewer` components (with prism-react-renderer)
- `renderer.code` outputs a placeholder `<div>` marker, which is replaced post-parse with `CodeViewer`
- Non-code HTML still uses `dangerouslySetInnerHTML` (for paragraphs, headings, lists, etc.)
- No more `highlightCode.ts` import
- Copy button for code blocks is now handled by `CodeViewer`'s `CopyButton` (instead of `data-copy-code` attribute)
- Prose classes preserved exactly as before

- [ ] **Step 2: Commit**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha && git add desktop/src/components/markdown/MarkdownRenderer.tsx && git commit -m "feat: rewrite MarkdownRenderer code blocks with React CodeViewer — no more HTML string templates"
```

---

### Task 5: Delete highlightCode.ts and clean up globals.css

**Files:**
- Delete: `desktop/src/components/chat/highlightCode.ts`
- Modify: `desktop/src/theme/globals.css` (lines 4-42)

- [ ] **Step 1: Delete highlightCode.ts**

```bash
rm /Users/nanmi/workspace/myself_code/claude-code-haha/desktop/src/components/chat/highlightCode.ts
```

- [ ] **Step 2: Remove all .hljs-* CSS rules from globals.css**

In `desktop/src/theme/globals.css`, delete lines 4-42 (the entire highlight.js theme section):

```css
/* DELETE everything from line 4 to line 42: */
/* ─── highlight.js dark theme (VS Code Dark+ inspired) ────────── */
.hljs { ... }
.hljs-keyword { ... }
/* ... all .hljs-* rules ... */
.hljs-punctuation { color: #57606a; }
```

Replace with a single comment:

```css
/* Code highlighting is handled by prism-react-renderer (inline styles) */
```

- [ ] **Step 3: Verify full TypeScript compilation**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npx tsc --noEmit
```

Expected: Zero errors. No file should import `highlightCode.ts`, `highlight.js`, or `diff` anymore.

- [ ] **Step 4: Run tests**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm test -- --run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha && git add -A && git commit -m "chore: delete highlightCode.ts and .hljs CSS — fully migrated to prism-react-renderer"
```

---

### Task 6: Final verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm run dev
```

- [ ] **Step 2: Verify visually**

Check in the running app:
1. **Code blocks with language** (e.g. ` ```python`): syntax highlighting + line numbers
2. **Code blocks without language** (e.g. ` ``` `): plain text, no line numbers, no colors
3. **Diff blocks** (Edit/Write tool calls): GitHub PR-style with green/red backgrounds, word-level diff highlighting, syntax coloring
4. **PermissionDialog** with Edit tool: shows diff preview correctly
5. **Markdown content**: headings, lists, tables, inline code all render correctly
6. **Copy buttons**: work in both code blocks and diff viewer header

- [ ] **Step 3: Verify bundle size improvement**

```bash
cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm run build 2>&1 | tail -20
```

Expected: Bundle size should be similar or smaller (prism-react-renderer ~12KB + react-diff-viewer-continued ~50KB vs highlight.js ~74KB + diff ~20KB).
