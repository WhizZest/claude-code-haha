# Chat UI Overhaul — Bug Fix, Feature Optimization, and UI Clone

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the desktop chat UI to match the original Claude Code's clean, compact design — fix CSS bugs in code blocks, add tool-call grouping/collapsing, and streamline all message components.

**Architecture:** Three-phase approach: (1) Fix CSS bugs in CodeViewer/DiffViewer/MarkdownRenderer for compact code blocks, (2) Implement ToolCallGroup component to collapse consecutive tool calls into summary lines like the original ("Read 7 files, ran a command"), (3) Streamline AssistantMessage, ThinkingBlock, and PermissionDialog to reduce visual noise and vertical space.

**Tech Stack:** React 18, Tailwind CSS 4, TypeScript, highlight.js, marked, diff

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `desktop/src/components/chat/CodeViewer.tsx` | Fix line height, padding, line number styling |
| Modify | `desktop/src/components/chat/DiffViewer.tsx` | Fix line height, add gutter indicators |
| Modify | `desktop/src/components/markdown/MarkdownRenderer.tsx` | Sync code block styles with CodeViewer fixes |
| Create | `desktop/src/components/chat/ToolCallGroup.tsx` | New component: collapsible group of tool calls |
| Modify | `desktop/src/components/chat/MessageList.tsx` | Group consecutive tool calls, use ToolCallGroup |
| Modify | `desktop/src/components/chat/ToolCallBlock.tsx` | Add compact mode, simplify badge display |
| Modify | `desktop/src/components/chat/AssistantMessage.tsx` | Remove Copy button reserved space, use absolute positioning |
| Modify | `desktop/src/components/chat/ThinkingBlock.tsx` | Reduce nesting, improve preview |
| Modify | `desktop/src/components/chat/StreamingIndicator.tsx` | Remove elapsed seconds display |
| Modify | `desktop/src/theme/globals.css` | Add code-block CSS variables |

---

### Task 1: Fix CodeViewer Line Height and Padding

**Files:**
- Modify: `desktop/src/components/chat/CodeViewer.tsx:57-78`

- [ ] **Step 1: Fix line height from 1.45 to 1.3**

In `CodeViewer.tsx`, line 57, change the container class:

```tsx
<div className="min-w-full font-[var(--font-mono)] text-[12px] leading-[1.3]">
```

- [ ] **Step 2: Reduce line padding from py-1 to py-px**

In `CodeViewer.tsx`, line 66, change the line number span padding:

```tsx
<span className="select-none border-r border-[#eaeef2] bg-[#fafbfc] px-2 py-px text-right text-[11px] text-[#8b949e]">
```

In `CodeViewer.tsx`, line 73, change the code content span padding:

```tsx
<span
  className="overflow-hidden bg-white px-3 py-px whitespace-pre-wrap break-words text-[#24292f]"
  dangerouslySetInnerHTML={{ __html: highlightedLines[index] ?? escapeHtml(line) }}
/>
```

- [ ] **Step 3: Soften border colors and remove per-line borders**

In `CodeViewer.tsx`, line 61-63, simplify the row div:

```tsx
<div
  key={`${startLine + index}-${line}`}
  className="grid grid-cols-[3rem,minmax(0,1fr)] gap-0 hover:bg-[#f6f8fa]/50"
>
```

Remove the `border-b border-[#d8dee4]` from each line — the per-line border creates visual noise and adds height.

- [ ] **Step 4: Soften the outer container and header**

In `CodeViewer.tsx`, line 44, change `rounded-2xl` to `rounded-lg` and soften border:

```tsx
<div className="overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
```

In `CodeViewer.tsx`, line 45, reduce header padding from `py-2` to `py-1.5`:

```tsx
<div className="flex items-center justify-between border-b border-[#d0d7de] bg-white px-3 py-1.5 text-[11px] text-[#57606a]">
```

- [ ] **Step 5: Fix the expand button colors (currently broken — white text on light bg)**

In `CodeViewer.tsx`, line 84, fix the expand toggle button:

```tsx
<button
  onClick={() => setExpanded((value) => !value)}
  className="w-full border-t border-[#d0d7de] bg-[#f6f8fa] py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#57606a] transition-colors hover:bg-[#eaeef2] hover:text-[#24292f]"
>
```

- [ ] **Step 6: Verify changes visually**

Run: `cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm run dev`

Open the app and send a message that produces code blocks. Verify:
- Lines are visually tighter (~16px per line instead of ~21px)
- Line numbers are subdued (light gray, no strong background contrast)
- No per-line horizontal borders
- Expand/collapse button is readable

- [ ] **Step 7: Commit**

```bash
git add desktop/src/components/chat/CodeViewer.tsx
git commit -m "fix: compact code block rendering — tighter line height, softer borders"
```

---

### Task 2: Fix DiffViewer Line Height and Add Gutter

**Files:**
- Modify: `desktop/src/components/chat/DiffViewer.tsx:49-79`

- [ ] **Step 1: Fix line height and padding in DiffViewer rows**

In `DiffViewer.tsx`, line 67, change the row container:

```tsx
className={`grid grid-cols-[2.5rem,2.5rem,1.25rem,minmax(0,1fr)] gap-0 font-[var(--font-mono)] text-[12px] leading-[1.3] ${rowClass}`}
```

Key changes: `leading-[1.45]` → `leading-[1.3]`, column widths from `3rem` to `2.5rem`.

- [ ] **Step 2: Fix line number and content padding**

In `DiffViewer.tsx`, lines 69-76, change all `py-1` to `py-px` and soften border colors:

```tsx
<span className="select-none border-r border-[#eaeef2] px-2 py-px text-right text-[11px] text-[#8b949e]">
  {line.oldLineNo ?? ''}
</span>
<span className="select-none border-r border-[#eaeef2] px-2 py-px text-right text-[11px] text-[#8b949e]">
  {line.newLineNo ?? ''}
</span>
<span className={`border-r border-[#eaeef2] px-1 py-px text-center ${prefixColor}`}>{prefix}</span>
<span className="whitespace-pre-wrap break-words px-3 py-px text-[#24292f]">{line.content}</span>
```

- [ ] **Step 3: Add gutter color indicator for added/removed lines**

Add a left border indicator to each row. In `DiffViewer.tsx`, update the `rowClass` computation (around line 50-55):

```tsx
const rowClass =
  line.type === 'added'
    ? 'bg-[#dafbe1]/60 border-l-2 border-l-[#1a7f37]'
    : line.type === 'removed'
      ? 'bg-[#ffebe9]/60 border-l-2 border-l-[#cf222e]'
      : 'bg-white border-l-2 border-l-transparent'
```

- [ ] **Step 4: Soften the outer container**

In `DiffViewer.tsx`, line 28, change `rounded-2xl` to `rounded-lg`:

```tsx
<div className="overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
```

Also reduce header padding in line 29:

```tsx
<div className="flex items-center justify-between border-b border-[#d0d7de] bg-white px-3 py-1.5">
```

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/chat/DiffViewer.tsx
git commit -m "fix: compact diff viewer — tighter rows, gutter indicators, softer borders"
```

---

### Task 3: Sync MarkdownRenderer Code Blocks

**Files:**
- Modify: `desktop/src/components/markdown/MarkdownRenderer.tsx:11-41`

- [ ] **Step 1: Update the code block renderer to match CodeViewer fixes**

In `MarkdownRenderer.tsx`, replace the entire `renderer.code` function (lines 11-41):

```tsx
renderer.code = function ({ text, lang }: Tokens.Code) {
  const languageLabel = escapeHtml(lang || 'code')
  const lines = text.split('\n')
  const highlightedLines = highlightCodeLines(text, lang)

  const body = highlightedLines
    .map((line, index) => `
      <div class="grid grid-cols-[3rem,minmax(0,1fr)] gap-0 hover:bg-[#f6f8fa]/50">
        <span class="select-none border-r border-[#eaeef2] bg-[#fafbfc] px-2 py-px text-right text-[11px] text-[#8b949e]">${index + 1}</span>
        <span class="overflow-hidden bg-white px-3 py-px whitespace-pre-wrap break-words text-[#24292f]">${line || '&nbsp;'}</span>
      </div>
    `)
    .join('')

  return `
    <div class="my-4 overflow-hidden rounded-lg border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
      <div class="flex items-center justify-between border-b border-[#d0d7de] bg-white px-3 py-1.5 text-[11px] text-[#57606a]">
        <div class="flex items-center gap-3">
          <span class="font-semibold uppercase tracking-[0.14em] text-[#57606a]">${languageLabel}</span>
          <span>${lines.length} ${lines.length === 1 ? 'line' : 'lines'}</span>
        </div>
        <button class="rounded-md border border-[#d0d7de] bg-white px-2 py-0.5 text-[11px] text-[#57606a] transition-colors hover:bg-[#f3f4f6] hover:text-[#24292f]" data-copy-code="${escapeHtml(text)}">
          Copy
        </button>
      </div>
      <div class="max-h-[420px] overflow-auto">
        <div class="min-w-full font-[var(--font-mono)] text-[12px] leading-[1.3]">${body}</div>
      </div>
    </div>
  `
}
```

Key changes synced with CodeViewer:
- `leading-[1.45]` → `leading-[1.3]`
- `py-1` → `py-px`
- `border-b border-[#d8dee4]` removed from rows
- `bg-[#f6f8fa]` → `bg-[#fafbfc]` for line numbers
- `text-[#57606a]` → `text-[#8b949e]` for line numbers
- `rounded-2xl` → `rounded-lg`
- Added `hover:bg-[#f6f8fa]/50` to rows

- [ ] **Step 2: Commit**

```bash
git add desktop/src/components/markdown/MarkdownRenderer.tsx
git commit -m "fix: sync markdown code blocks with CodeViewer compact styles"
```

---

### Task 4: Create ToolCallGroup Component

**Files:**
- Create: `desktop/src/components/chat/ToolCallGroup.tsx`

- [ ] **Step 1: Create the ToolCallGroup component**

Create `desktop/src/components/chat/ToolCallGroup.tsx`:

```tsx
import { useState } from 'react'
import { ToolCallBlock } from './ToolCallBlock'
import type { UIMessage } from '../../types/chat'

type ToolCall = Extract<UIMessage, { type: 'tool_use' }>
type ToolResult = Extract<UIMessage, { type: 'tool_result' }>

type Props = {
  toolCalls: ToolCall[]
  resultMap: Map<string, ToolResult>
  /** When true, the last tool is still executing — show expanded */
  isStreaming?: boolean
}

const TOOL_VERBS: Record<string, (count: number) => string> = {
  Read: (n) => `Read ${n} file${n > 1 ? 's' : ''}`,
  Write: (n) => `created ${n > 1 ? `${n} files` : 'a file'}`,
  Edit: (n) => `edited ${n > 1 ? `${n} files` : 'a file'}`,
  Bash: (n) => `ran ${n > 1 ? `${n} commands` : 'a command'}`,
  Glob: (n) => `found files`,
  Grep: (n) => `searched ${n > 1 ? `${n} patterns` : 'code'}`,
  Agent: (n) => `dispatched ${n > 1 ? `${n} agents` : 'an agent'}`,
  WebSearch: (n) => `searched the web`,
  WebFetch: (n) => `fetched ${n > 1 ? `${n} pages` : 'a page'}`,
}

function generateSummary(toolCalls: ToolCall[]): string {
  const counts = new Map<string, number>()
  for (const tc of toolCalls) {
    counts.set(tc.toolName, (counts.get(tc.toolName) ?? 0) + 1)
  }

  const parts: string[] = []
  for (const [name, count] of counts) {
    const verbFn = TOOL_VERBS[name]
    parts.push(verbFn ? verbFn(count) : `${name} (${count})`)
  }

  return parts.join(', ')
}

function hasErrors(toolCalls: ToolCall[], resultMap: Map<string, ToolResult>): boolean {
  return toolCalls.some((tc) => {
    const result = resultMap.get(tc.toolUseId)
    return result?.isError
  })
}

export function ToolCallGroup({ toolCalls, resultMap, isStreaming }: Props) {
  // Single tool call — render directly without group wrapper
  if (toolCalls.length === 1) {
    const tc = toolCalls[0]
    const result = resultMap.get(tc.toolUseId)
    return (
      <ToolCallBlock
        toolName={tc.toolName}
        input={tc.input}
        result={result ? { content: result.content, isError: result.isError } : null}
      />
    )
  }

  const [expanded, setExpanded] = useState(false)
  const summary = generateSummary(toolCalls)
  const errorPresent = hasErrors(toolCalls, resultMap)
  const allComplete = toolCalls.every((tc) => resultMap.has(tc.toolUseId))

  return (
    <div className="mb-2 ml-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition-colors ${
          errorPresent
            ? 'border border-[var(--color-error)]/20 bg-[var(--color-error-container)]/30 hover:bg-[var(--color-error-container)]/50'
            : 'border border-[var(--color-border)]/40 bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container-high)]'
        }`}
      >
        <span className="material-symbols-outlined text-[14px] text-[var(--color-outline)]">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
        <span className="flex-1 truncate text-[12px] text-[var(--color-text-secondary)]">
          {summary}
        </span>
        {!isStreaming && allComplete && !errorPresent && (
          <span className="material-symbols-outlined text-[14px] text-[var(--color-success)]">check_circle</span>
        )}
        {errorPresent && (
          <span className="rounded-full bg-[var(--color-error-container)] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--color-error)]">
            ERROR
          </span>
        )}
        {isStreaming && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)] animate-pulse-dot" />
        )}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1">
          {toolCalls.map((tc) => {
            const result = resultMap.get(tc.toolUseId)
            return (
              <ToolCallBlock
                key={tc.id}
                toolName={tc.toolName}
                input={tc.input}
                result={result ? { content: result.content, isError: result.isError } : null}
                compact
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add desktop/src/components/chat/ToolCallGroup.tsx
git commit -m "feat: add ToolCallGroup component for collapsible tool call summaries"
```

---

### Task 5: Add Compact Mode to ToolCallBlock

**Files:**
- Modify: `desktop/src/components/chat/ToolCallBlock.tsx:7-114`

- [ ] **Step 1: Add `compact` prop and adjust rendering**

In `ToolCallBlock.tsx`, add `compact` to the Props type (line 7-11):

```tsx
type Props = {
  toolName: string
  input: unknown
  result?: { content: unknown; isError: boolean } | null
  compact?: boolean
}
```

Update the component signature (line 34):

```tsx
export function ToolCallBlock({ toolName, input, result, compact = false }: Props) {
```

- [ ] **Step 2: Adjust the outer container for compact mode**

In `ToolCallBlock.tsx`, update the outer div (line 53):

```tsx
<div className={`overflow-hidden rounded-lg border border-[var(--color-border)]/50 bg-[var(--color-surface-container-lowest)] ${
  compact ? 'mb-0' : 'mb-2 ml-10'
}`}>
```

Key changes:
- `rounded-xl` → `rounded-lg`
- `mb-2 ml-10` only when not compact (ToolCallGroup handles margins)
- Border opacity reduced

- [ ] **Step 3: Simplify the summary row — reduce from 6 info layers to 3**

In `ToolCallBlock.tsx`, replace lines 62-105 (the button contents) with a cleaner layout:

```tsx
<button
  type="button"
  onClick={() => {
    if (expandable) {
      setExpanded((value) => !value)
    }
  }}
  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]/50"
>
  <span className="material-symbols-outlined text-[14px] text-[var(--color-outline)]">{icon}</span>
  <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
    {toolName}
  </span>
  {filePath ? (
    <span className="min-w-0 flex-1 truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">
      {filePath.split('/').pop()}
    </span>
  ) : summary ? (
    <span className="min-w-0 flex-1 truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">
      {summary}
    </span>
  ) : (
    <span className="flex-1" />
  )}
  {result && outputSummary && (
    <span className="shrink-0 text-[10px] text-[var(--color-outline)]">
      {outputSummary}
    </span>
  )}
  {result?.isError && (
    <span className="shrink-0 rounded-full bg-[var(--color-error-container)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-error)]">
      ERROR
    </span>
  )}
  {expandable && (
    <span className="material-symbols-outlined text-[14px] text-[var(--color-outline)]">
      {expanded ? 'expand_less' : 'expand_more'}
    </span>
  )}
</button>
```

Key changes:
- Removed the standalone SUCCESS/MODIFIED/READ/EXECUTED badges for non-error states
- Simplified to single-line: `icon + toolName + filePath/summary + outputSummary + expand`
- Only ERROR badge shown for errors
- Reduced padding from `py-2.5` to `py-2`
- Removed the nested divs and multi-line layout

- [ ] **Step 4: Remove unused badge constant**

In `ToolCallBlock.tsx`, remove the `STATUS_BADGE` constant (lines 27-32) since we no longer show per-tool status badges:

```tsx
// DELETE these lines:
// const STATUS_BADGE: Record<string, { label: string; className: string }> = {
//   Edit: { ... },
//   Write: { ... },
//   Read: { ... },
//   Bash: { ... },
// }
```

Also remove the `badge` variable computation (lines 42-46).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/chat/ToolCallBlock.tsx
git commit -m "feat: add compact mode to ToolCallBlock, simplify to single-line layout"
```

---

### Task 6: Update MessageList to Group Tool Calls

**Files:**
- Modify: `desktop/src/components/chat/MessageList.tsx`

- [ ] **Step 1: Add grouping logic and import ToolCallGroup**

Replace the entire `MessageList.tsx` with:

```tsx
import { useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallBlock } from './ToolCallBlock'
import { ToolCallGroup } from './ToolCallGroup'
import { ToolResultBlock } from './ToolResultBlock'
import { PermissionDialog } from './PermissionDialog'
import { AskUserQuestion } from './AskUserQuestion'
import { StreamingIndicator } from './StreamingIndicator'
import type { UIMessage } from '../../types/chat'

type ToolCall = Extract<UIMessage, { type: 'tool_use' }>
type ToolResult = Extract<UIMessage, { type: 'tool_result' }>

/**
 * Group consecutive tool_use messages together.
 * A group breaks when a non-tool message (assistant_text, thinking, etc.) appears.
 * Returns an array of render items — either a group or a single message.
 */
type RenderItem =
  | { kind: 'tool_group'; toolCalls: ToolCall[]; id: string }
  | { kind: 'message'; message: UIMessage }

function buildRenderItems(messages: UIMessage[], toolUseIds: Set<string>): RenderItem[] {
  const items: RenderItem[] = []
  let pendingToolCalls: ToolCall[] = []

  const flushGroup = () => {
    if (pendingToolCalls.length > 0) {
      items.push({
        kind: 'tool_group',
        toolCalls: [...pendingToolCalls],
        id: `group-${pendingToolCalls[0].id}`,
      })
      pendingToolCalls = []
    }
  }

  for (const msg of messages) {
    // Skip tool_results that will be rendered inside their ToolCallBlock/Group
    if (msg.type === 'tool_result' && toolUseIds.has(msg.toolUseId)) {
      continue
    }

    if (msg.type === 'tool_use') {
      // Skip AskUserQuestion — it renders separately
      if (msg.toolName === 'AskUserQuestion') {
        flushGroup()
        items.push({ kind: 'message', message: msg })
      } else {
        pendingToolCalls.push(msg)
      }
    } else {
      flushGroup()
      items.push({ kind: 'message', message: msg })
    }
  }

  flushGroup()
  return items
}

export function MessageList() {
  const { messages, chatState, streamingText, activeThinkingId } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages.length, streamingText])

  // Build lookup maps
  const toolUseIds = new Set<string>()
  const toolResultMap = new Map<string, ToolResult>()

  for (const msg of messages) {
    if (msg.type === 'tool_use') {
      toolUseIds.add(msg.toolUseId)
    }
    if (msg.type === 'tool_result' && msg.toolUseId) {
      toolResultMap.set(msg.toolUseId, msg)
    }
  }

  const renderItems = buildRenderItems(messages, toolUseIds)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-[860px]">
        {renderItems.map((item) => {
          if (item.kind === 'tool_group') {
            return (
              <ToolCallGroup
                key={item.id}
                toolCalls={item.toolCalls}
                resultMap={toolResultMap}
                isStreaming={
                  chatState === 'tool_executing' &&
                  item.toolCalls.some((tc) => !toolResultMap.has(tc.toolUseId))
                }
              />
            )
          }

          const msg = item.message
          return (
            <MessageBlock
              key={msg.id}
              message={msg}
              activeThinkingId={activeThinkingId}
              toolResult={
                msg.type === 'tool_use'
                  ? toolResultMap.get(msg.toolUseId) ?? null
                  : null
              }
            />
          )
        })}

        {streamingText && chatState === 'streaming' && (
          <AssistantMessage content={streamingText} isStreaming />
        )}

        {chatState !== 'idle' && chatState !== 'streaming' && chatState !== 'permission_pending' && (
          <StreamingIndicator />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function MessageBlock({
  message,
  activeThinkingId,
  toolResult,
}: {
  message: UIMessage
  activeThinkingId: string | null
  toolResult?: { content: unknown; isError: boolean } | null
}) {
  switch (message.type) {
    case 'user_text':
      return <UserMessage content={message.content} attachments={message.attachments} />
    case 'assistant_text':
      return <AssistantMessage content={message.content} />
    case 'thinking':
      return <ThinkingBlock content={message.content} isActive={message.id === activeThinkingId} />
    case 'tool_use':
      if (message.toolName === 'AskUserQuestion') {
        return (
          <AskUserQuestion
            toolUseId={message.toolUseId}
            input={message.input}
          />
        )
      }
      return (
        <ToolCallBlock
          toolName={message.toolName}
          input={message.input}
          result={toolResult}
        />
      )
    case 'tool_result':
      return (
        <ToolResultBlock
          content={message.content}
          isError={message.isError}
          standalone
        />
      )
    case 'permission_request':
      return (
        <PermissionDialog
          requestId={message.requestId}
          toolName={message.toolName}
          input={message.input}
          description={message.description}
        />
      )
    case 'error':
      return (
        <div className="mb-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-[var(--color-error)]">
          <strong>Error:</strong> {message.message}
        </div>
      )
    case 'system':
      return (
        <div className="mb-3 text-center text-xs text-[var(--color-text-tertiary)]">
          {message.content}
        </div>
      )
  }
}
```

Key changes:
- Added `buildRenderItems()` to group consecutive `tool_use` messages
- `ToolCallGroup` renders groups of 2+ tool calls as a collapsible summary
- Single tool calls still render as individual `ToolCallBlock`
- `tool_result` messages are passed via `toolResultMap` to groups
- Simplified error/system message margins to `mb-3`

- [ ] **Step 2: Commit**

```bash
git add desktop/src/components/chat/MessageList.tsx
git commit -m "feat: group consecutive tool calls into collapsible summaries"
```

---

### Task 7: Streamline AssistantMessage

**Files:**
- Modify: `desktop/src/components/chat/AssistantMessage.tsx`

- [ ] **Step 1: Remove Copy button reserved space — use absolute positioning**

Replace the entire `AssistantMessage.tsx`:

```tsx
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { useState } from 'react'

type Props = {
  content: string
  isStreaming?: boolean
}

export function AssistantMessage({ content, isStreaming }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="group relative mb-3 ml-10">
      {/* Copy button — absolute positioned, no reserved space */}
      {!isStreaming && content.trim() && (
        <button
          onClick={handleCopy}
          className="absolute -right-1 -top-1 rounded-md border border-[var(--color-border)]/60 bg-[var(--color-surface)] px-2 py-0.5 text-[10px] text-[var(--color-text-tertiary)] opacity-0 shadow-sm transition-opacity hover:text-[var(--color-text-primary)] group-hover:opacity-100"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
      <div className="text-sm text-[var(--color-text-primary)]">
        <MarkdownRenderer content={content} />
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-[var(--color-brand)] animate-shimmer ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  )
}
```

Key changes:
- Removed the avatar (saves 28px + 12px gap = 40px horizontal space)
- `mb-5` → `mb-3` (consistent with other blocks)
- Copy button is now `absolute -right-1 -top-1` — zero reserved space
- Removed the flex layout with avatar, now uses `ml-10` to match tool call alignment
- Simplified structure from 3 nested divs to 2

- [ ] **Step 2: Commit**

```bash
git add desktop/src/components/chat/AssistantMessage.tsx
git commit -m "fix: remove assistant avatar and copy-button reserved space"
```

---

### Task 8: Streamline ThinkingBlock

**Files:**
- Modify: `desktop/src/components/chat/ThinkingBlock.tsx`

- [ ] **Step 1: Reduce nesting and improve preview**

Replace the entire `ThinkingBlock.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'

export function ThinkingBlock({ content, isActive = false }: { content: string; isActive?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded && isActive && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [content, expanded, isActive])

  // Preview: take first meaningful line, not first 140 chars
  const lines = content.split('\n').filter((l) => l.trim())
  const firstLine = lines[0]?.replace(/\s+/g, ' ').trim() || ''
  const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine

  return (
    <div className="mb-1 ml-10">
      <style>{thinkingStyles}</style>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
      >
        <span className="text-[10px] text-[var(--color-outline)]">
          {expanded ? '\u25BE' : '\u25B8'}
        </span>
        <span className="shrink-0 font-medium italic">
          Thinking
          {isActive && <span className="thinking-dots" />}
        </span>
        {!expanded && preview && (
          <span className="min-w-0 flex-1 truncate font-[var(--font-mono)] text-[11px] text-[var(--color-text-tertiary)]">
            {preview}
            {isActive && <span className="thinking-inline-cursor" />}
          </span>
        )}
      </button>
      {expanded && (
        <div
          ref={contentRef}
          className="mt-1 max-h-[300px] overflow-y-auto rounded-lg border border-[var(--color-border)]/40 bg-[var(--color-surface-container-lowest)] p-2.5 font-[var(--font-mono)] text-[11px] leading-[1.35] text-[var(--color-text-secondary)] whitespace-pre-wrap break-words"
        >
          {content}
          {isActive && expanded && <span className="thinking-cursor" />}
        </div>
      )}
    </div>
  )
}

const thinkingStyles = `
@keyframes thinking-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes thinking-dots {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
.thinking-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-text-tertiary);
  vertical-align: middle;
  margin-left: 1px;
  animation: thinking-cursor-blink 1s step-end infinite;
}
.thinking-inline-cursor {
  display: inline-block;
  width: 1px;
  height: 0.95em;
  margin-left: 3px;
  vertical-align: text-bottom;
  background: var(--color-text-tertiary);
  animation: thinking-cursor-blink 1s step-end infinite;
}
.thinking-dots::after {
  content: '';
  animation: thinking-dots 1.4s steps(1, end) infinite;
}
`
```

Key changes:
- Removed the `rounded-full` expand icon — just use a simple triangle character
- Removed 1 layer of nesting in the expanded state (was: outer div → inner div → content; now: outer div → content div)
- `rounded-2xl` → `rounded-lg`
- `mb-2` → `mb-1` (more compact)
- `max-h-[220px]` → `max-h-[300px]` (give more room when expanded)
- Preview now takes the first line instead of first 140 chars (more meaningful)
- `leading-[1.45]` → `leading-[1.35]`

- [ ] **Step 2: Commit**

```bash
git add desktop/src/components/chat/ThinkingBlock.tsx
git commit -m "fix: streamline ThinkingBlock — less nesting, better preview"
```

---

### Task 9: Simplify StreamingIndicator

**Files:**
- Modify: `desktop/src/components/chat/StreamingIndicator.tsx`

- [ ] **Step 1: Remove elapsed seconds, keep only essential info**

Replace `StreamingIndicator.tsx`:

```tsx
import { useChatStore } from '../../stores/chatStore'

export function StreamingIndicator() {
  const { chatState } = useChatStore()

  const verb = chatState === 'thinking'
    ? 'Thinking'
    : chatState === 'tool_executing'
      ? 'Running'
      : 'Working'

  return (
    <div className="mb-2 ml-10 flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)]/40 bg-[var(--color-surface-container-low)] px-3 py-1">
      <span className="text-[var(--color-brand)] animate-shimmer text-xs">✦</span>
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{verb}...</span>
    </div>
  )
}
```

Key changes:
- Removed `elapsedSeconds` display (users don't need per-second counts)
- Removed `tokenUsage` display (noise)
- `mb-4` → `mb-2`, `py-1.5` → `py-1`
- `text-sm` → `text-xs` (more compact)
- Simplified verb labels

- [ ] **Step 2: Commit**

```bash
git add desktop/src/components/chat/StreamingIndicator.tsx
git commit -m "fix: simplify StreamingIndicator — remove elapsed time and token count"
```

---

### Task 10: Final Visual Verification

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm run dev`

- [ ] **Step 2: Run the TypeScript compiler to check for type errors**

Run: `cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 3: Run existing tests**

Run: `cd /Users/nanmi/workspace/myself_code/claude-code-haha/desktop && npm test -- --run`

Expected: All tests pass.

- [ ] **Step 4: Verify the chat UI visually**

Check these items in the running app:
1. **Code blocks:** Lines are tight (~16px/line), no per-line borders, line numbers are subdued
2. **Diff blocks:** Compact rows with green/red gutter indicators
3. **Tool calls:** 2+ consecutive tool calls show as "Read 3 files, ran a command" summary line
4. **Single tool call:** Still shows as individual ToolCallBlock
5. **Thinking:** Single-line with first-line preview, click expands to scrollable content
6. **Assistant messages:** No avatar, copy button appears on hover without reserving space
7. **Streaming indicator:** Compact, no elapsed time counter

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address visual polish issues found during verification"
```
