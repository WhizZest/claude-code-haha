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
  Glob: (_n) => `found files`,
  Grep: (n) => `searched ${n > 1 ? `${n} patterns` : 'code'}`,
  Agent: (n) => `dispatched ${n > 1 ? `${n} agents` : 'an agent'}`,
  WebSearch: (_n) => `searched the web`,
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

function groupHasErrors(toolCalls: ToolCall[], resultMap: Map<string, ToolResult>): boolean {
  return toolCalls.some((tc) => {
    const result = resultMap.get(tc.toolUseId)
    return result?.isError
  })
}

export function ToolCallGroup({ toolCalls, resultMap, isStreaming }: Props) {
  // Single tool call — render directly without group wrapper
  if (toolCalls.length === 1) {
    const tc = toolCalls[0]!
    const result = resultMap.get(tc.toolUseId)
    return (
      <ToolCallBlock
        toolName={tc.toolName}
        input={tc.input}
        result={result ? { content: result.content, isError: result.isError } : null}
      />
    )
  }

  return <ToolCallGroupMulti toolCalls={toolCalls} resultMap={resultMap} isStreaming={isStreaming} />
}

/** Separated so the useState hook is never called conditionally. */
function ToolCallGroupMulti({ toolCalls, resultMap, isStreaming }: Props) {
  const [expanded, setExpanded] = useState(false)
  const summary = generateSummary(toolCalls)
  const errorPresent = groupHasErrors(toolCalls, resultMap)
  const allComplete = toolCalls.every((tc) => resultMap.has(tc.toolUseId))

  return (
    <div className="mb-2 ml-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-border)]/40 bg-[var(--color-surface-container-low)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--color-surface-container-high)]"
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
        {!isStreaming && errorPresent && (
          <span className="material-symbols-outlined text-[14px] text-[var(--color-error)]">error</span>
        )}
        {!isStreaming && !allComplete && !errorPresent && (
          <span className="material-symbols-outlined text-[14px] text-[var(--color-outline)]">pending</span>
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
