import { useEffect, useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { MessageList } from '../components/chat/MessageList'
import { ChatInput } from '../components/chat/ChatInput'
import { TeamStatusBar } from '../components/teams/TeamStatusBar'

export function ActiveSession() {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const { chatState, tokenUsage } = useChatStore()

  const session = sessions.find((s) => s.id === activeSessionId)

  useEffect(() => {
    if (activeSessionId) {
      connectToSession(activeSessionId)
    }
  }, [activeSessionId, connectToSession])

  const isActive = chatState !== 'idle'
  const totalTokens = tokenUsage.input_tokens + tokenUsage.output_tokens

  const lastUpdated = useMemo(() => {
    if (!session?.modifiedAt) return ''
    const diff = Date.now() - new Date(session.modifiedAt).getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }, [session?.modifiedAt])

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background text-on-surface">
      {/* Session info header */}
      <div className="mx-auto flex w-full max-w-[860px] items-center border-b border-outline-variant/10 px-8 py-3">
        <div className="flex-1">
          <h1 className="text-lg font-bold font-headline text-on-surface leading-tight">
            {session?.title || 'Untitled Session'}
          </h1>
          <div className="flex items-center gap-2 text-[10px] text-outline font-medium mt-1">
            {isActive && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse-dot" />
                session active
              </span>
            )}
            {totalTokens > 0 && (
              <>
                <span className="text-[var(--color-outline)]">·</span>
                <span>{totalTokens.toLocaleString()} t</span>
              </>
            )}
            {lastUpdated && (
              <>
                <span className="text-[var(--color-outline)]">·</span>
                <span>last updated {lastUpdated}</span>
              </>
            )}
            {session?.messageCount !== undefined && session.messageCount > 0 && (
              <>
                <span className="text-[var(--color-outline)]">·</span>
                <span>{session.messageCount} messages</span>
              </>
            )}
          </div>
          {session?.workDirExists === false && (
            <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/8 px-3 py-1.5 text-[11px] text-[var(--color-error)]">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              <span className="truncate">
                Workspace unavailable: {session.workDir || 'directory no longer exists'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message stream */}
      <MessageList />

      {/* Team status bar */}
      <TeamStatusBar />

      {/* Chat input */}
      <ChatInput />
    </div>
  )
}
