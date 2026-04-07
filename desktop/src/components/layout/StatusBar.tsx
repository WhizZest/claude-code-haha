import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'

export function StatusBar() {
  const { currentModel } = useSettingsStore()
  const { connectionState } = useChatStore()
  const { sessions, activeSessionId } = useSessionStore()

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const statusColor =
    connectionState === 'connected'
      ? 'bg-[var(--color-success)]'
      : connectionState === 'connecting' || connectionState === 'reconnecting'
        ? 'bg-[var(--color-warning)] animate-pulse-dot'
        : 'bg-[var(--color-error)]'

  const statusText =
    connectionState === 'connected'
      ? 'Connected'
      : connectionState === 'connecting'
        ? 'Connecting...'
        : connectionState === 'reconnecting'
          ? 'Reconnecting...'
          : 'Disconnected'

  const projectName = activeSession?.projectPath
    ? activeSession.projectPath.split('-').filter(Boolean).pop() || ''
    : ''

  return (
    <div className="h-[var(--statusbar-height)] flex items-center justify-between px-4 border-t border-[var(--color-border)] bg-[var(--color-surface-sidebar)] select-none text-[11px]">
      {/* Left: User info + plan */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
          <span className="text-[var(--color-text-tertiary)]">{statusText}</span>
        </div>

        {projectName && (
          <>
            <span className="text-[var(--color-outline)]">·</span>
            <span className="text-[var(--color-text-secondary)] font-[var(--font-mono)]">{projectName}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {currentModel && (
          <span className="text-[var(--color-text-tertiary)] font-[var(--font-mono)]">
            {currentModel.name}
          </span>
        )}
      </div>
    </div>
  )
}
