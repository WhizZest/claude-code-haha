import { useTeamStore } from '../../stores/teamStore'

export function TranscriptView() {
  const { agentTranscript, viewingAgentId, activeTeam } = useTeamStore()
  const member = activeTeam?.members.find((m) => m.agentId === viewingAgentId)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="max-w-[720px] mx-auto">
        {/* Viewing divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-xs text-[var(--color-text-tertiary)]">
            Viewing: {member?.role || viewingAgentId} transcript
          </span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>

        {/* Transcript messages */}
        {agentTranscript.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-text-tertiary)] py-8">
            No messages yet
          </div>
        ) : (
          agentTranscript.map((msg) => (
            <div key={msg.id} className="mb-3 text-sm text-[var(--color-text-primary)]">
              <pre className="whitespace-pre-wrap break-words font-[var(--font-mono)] text-xs bg-[var(--color-surface-info)] rounded-[var(--radius-md)] px-3 py-2">
                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
