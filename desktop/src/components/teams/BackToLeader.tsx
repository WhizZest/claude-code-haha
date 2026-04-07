import { useTeamStore } from '../../stores/teamStore'

export function BackToLeader() {
  const setViewingAgent = useTeamStore((s) => s.setViewingAgent)

  return (
    <button
      onClick={() => setViewingAgent(null)}
      className="flex items-center gap-1 px-3 py-1.5 text-sm text-[var(--color-text-accent)] hover:underline transition-colors"
    >
      ← Back to Leader
    </button>
  )
}
