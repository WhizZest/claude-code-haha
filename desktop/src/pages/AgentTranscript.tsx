import { useEffect } from 'react'
import { useTeamStore } from '../stores/teamStore'
import { mockTranscript } from '../mocks/data'

function Icon({ name, className = '', filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}

export function AgentTranscript() {
  const { viewingAgentId, activeTeam, agentTranscript, setViewingAgent, fetchMemberTranscript } = useTeamStore()

  const viewingMember = activeTeam?.members.find((m) => m.agentId === viewingAgentId)
  const agentName = viewingMember?.role ?? mockTranscript.agentName

  useEffect(() => {
    if (viewingAgentId && activeTeam) {
      fetchMemberTranscript(activeTeam.name, viewingAgentId)
    }
  }, [viewingAgentId, activeTeam, fetchMemberTranscript])

  // Use real transcript if available, fall back to mock
  const messages = agentTranscript.length > 0
    ? agentTranscript.map((msg, i) => ({
        id: msg.id || `t-${i}`,
        role: 'agent' as const,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        timestamp: msg.timestamp,
      }))
    : mockTranscript.messages

  const teamMembers = activeTeam
    ? activeTeam.members.map((m) => ({
        id: m.agentId,
        role: m.role,
        active: m.agentId === viewingAgentId,
      }))
    : mockTranscript.teamBar

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-background text-on-surface selection:bg-primary-fixed">
      {/* Context Banner */}
      <div className="sticky top-0 z-30 bg-primary-container/10 backdrop-blur-md px-6 py-2 border-b border-primary/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-primary">
            Viewing: {agentName} transcript
          </span>
        </div>
        <button
          onClick={() => setViewingAgent(null)}
          className="text-xs font-bold text-primary flex items-center gap-1 hover:underline cursor-pointer"
        >
          <Icon name="arrow_back" className="text-xs" />
          Back to Leader
        </button>
      </div>

      {/* Teammate Transcript Stream */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto px-6 py-8 space-y-8 pb-24">
        {messages.map((msg) => {
          if (msg.role === 'agent') {
            return (
              <div key={msg.id} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high shrink-0 flex items-center justify-center">
                  <Icon name="smart_toy" className="text-secondary" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-on-surface">{agentName}</span>
                    <span className="text-[10px] text-outline font-mono">{msg.timestamp}</span>
                  </div>
                  <div className="p-5 bg-surface-container-lowest rounded-xl border border-outline-variant/15 shadow-sm">
                    <p className="text-on-surface leading-relaxed text-sm">{msg.content}</p>
                  </div>
                </div>
              </div>
            )
          }

          if (msg.role === 'tool') {
            return (
              <div key={msg.id} className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                  <Icon name="terminal" className="text-outline" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-outline font-bold">
                    <span>Tool Call: {msg.toolName?.toLowerCase()}</span>
                    <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded-full">
                      {msg.status}
                    </span>
                  </div>
                  <div className="rounded-lg overflow-hidden bg-surface-dim border border-outline-variant/20">
                    <div className="flex items-center gap-2 px-4 py-2 bg-on-surface/5 border-b border-outline-variant/10">
                      <div className="w-2 h-2 rounded-full bg-error/40" />
                      <div className="w-2 h-2 rounded-full bg-primary-container/40" />
                      <div className="w-2 h-2 rounded-full bg-tertiary-container/40" />
                      <span className="ml-2 text-[10px] font-mono text-outline">
                        ~/projects/companion/src/components
                      </span>
                    </div>
                    <pre className="p-4 text-xs font-mono text-on-surface leading-5 overflow-x-auto">
                      <code>{msg.command}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )
          }

          if (msg.role === 'progress') {
            return (
              <div key={msg.id} className="flex gap-4 items-start">
                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                  <Icon name="insights" className="text-outline" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-surface-container-low rounded-lg border border-outline-variant/5">
                    <Icon name="sync" className="text-primary text-lg" filled />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-on-surface">{msg.label}</p>
                      <div className="w-full bg-surface-variant h-1 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${msg.progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-outline">{msg.progress}%</span>
                  </div>
                </div>
              </div>
            )
          }

          return null
        })}
      </div>

      {/* ── Team Strip (Persistent Navigation) ── */}
      <div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/20 rounded-2xl p-2 px-4 flex items-center gap-4 shadow-2xl z-10">
        <div className="text-[10px] font-bold text-outline uppercase tracking-tighter pr-4 border-r border-outline-variant/20">
          The Team
        </div>
        <div className="flex items-center gap-2">
          {teamMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => setViewingAgent(member.id)}
              className={`flex items-center gap-2 p-1.5 px-3 rounded-xl transition-colors ${
                member.active
                  ? 'bg-primary-fixed text-on-primary-fixed'
                  : 'hover:bg-surface-container-high'
              }`}
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                member.active ? 'bg-on-primary-fixed/10' : 'bg-surface-container-high'
              }`}>
                <Icon name="smart_toy" className="text-xs" />
              </div>
              <span className={`text-xs ${member.active ? 'font-bold' : 'font-semibold'}`}>
                {member.role}
              </span>
              {member.active && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-[10px] text-outline italic">Teammate is thinking...</span>
          <button
            onClick={() => setViewingAgent(null)}
            className="w-8 h-8 rounded-full bg-on-surface text-surface flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Icon name="arrow_back" className="text-sm" />
          </button>
        </div>
      </div>
    </div>
  )
}
