import { useTeamStore } from '../../stores/teamStore'
import type { TeamMember, AgentColor } from '../../types/team'

const COLOR_MAP: Record<AgentColor, string> = {
  red: 'var(--color-agent-red)',
  blue: 'var(--color-agent-blue)',
  green: 'var(--color-agent-green)',
  yellow: 'var(--color-agent-yellow)',
  purple: 'var(--color-agent-purple)',
  orange: 'var(--color-agent-orange)',
  pink: 'var(--color-agent-pink)',
  cyan: 'var(--color-agent-cyan)',
}

const STATUS_STYLES: Record<string, { dotClass: string; color: string }> = {
  running: { dotClass: 'animate-pulse-dot', color: 'var(--color-warning)' },
  completed: { dotClass: '', color: 'var(--color-success)' },
  error: { dotClass: '', color: 'var(--color-error)' },
  idle: { dotClass: '', color: 'var(--color-text-tertiary)' },
}

export function MemberTag({ member }: { member: TeamMember }) {
  const { setViewingAgent, viewingAgentId, memberColors } = useTeamStore()
  const isViewing = viewingAgentId === member.agentId
  const color = member.color || memberColors.get(member.agentId) || 'blue'
  const agentColor = COLOR_MAP[color]
  const statusInfo = STATUS_STYLES[member.status] || STATUS_STYLES.idle!

  return (
    <button
      onClick={() => setViewingAgent(isViewing ? null : member.agentId)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-medium transition-colors"
      style={{
        backgroundColor: isViewing ? `color-mix(in srgb, ${agentColor} 15%, transparent)` : 'var(--color-surface-selected)',
        border: isViewing ? `2px solid ${agentColor}` : '2px solid transparent',
      }}
    >
      {/* Status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`}
        style={{ backgroundColor: statusInfo.color }}
      />
      <span className="text-[var(--color-text-primary)]">{member.role || member.agentId}</span>
    </button>
  )
}
