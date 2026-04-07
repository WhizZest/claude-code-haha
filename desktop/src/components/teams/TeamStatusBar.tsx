import { useTeamStore } from '../../stores/teamStore'
import { MemberTag } from './MemberTag'

export function TeamStatusBar() {
  const { activeTeam } = useTeamStore()

  if (!activeTeam) return null

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-info)]">
      {/* Team header */}
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
          Team: {activeTeam.name}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          ({activeTeam.members.length} members)
        </span>
      </div>

      {/* Member tags */}
      <div className="px-4 pb-2 flex flex-wrap gap-2">
        {activeTeam.members.map((member) => (
          <MemberTag key={member.agentId} member={member} />
        ))}
      </div>
    </div>
  )
}
