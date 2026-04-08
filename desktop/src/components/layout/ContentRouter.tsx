import { useUIStore } from '../../stores/uiStore'
import { useTabStore } from '../../stores/tabStore'
import { useTeamStore } from '../../stores/teamStore'
import { EmptySession } from '../../pages/EmptySession'
import { ActiveSession } from '../../pages/ActiveSession'
import { ScheduledTasks } from '../../pages/ScheduledTasks'
import { Settings } from '../../pages/Settings'
import { AgentTranscript } from '../../pages/AgentTranscript'

export function ContentRouter() {
  const activeView = useUIStore((s) => s.activeView)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const viewingAgentId = useTeamStore((s) => s.viewingAgentId)

  if (activeView === 'settings') {
    return <Settings />
  }

  if (activeView === 'scheduled') {
    return <ScheduledTasks />
  }

  if (activeView === 'terminal') {
    return <TerminalPlaceholder />
  }

  if (activeView === 'history') {
    // If viewing an agent transcript, show that
    if (viewingAgentId) {
      return <AgentTranscript />
    }
    return <HistoryPlaceholder />
  }

  // Code view
  if (!activeTabId) {
    return <EmptySession />
  }

  if (viewingAgentId) {
    return <AgentTranscript />
  }

  return <ActiveSession />
}

function TerminalPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e1e] text-[#d4d4d4]">
      <span className="material-symbols-outlined text-[48px] text-[#555] mb-4">terminal</span>
      <h2 className="text-lg font-semibold text-[#999] mb-2">Terminal</h2>
      <p className="text-sm text-[#666] max-w-sm text-center">
        Integrated terminal coming soon. Use the Code tab to interact with Claude.
      </p>
    </div>
  )
}

function HistoryPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--color-surface)]">
      <span className="material-symbols-outlined text-[48px] text-[var(--color-outline)] mb-4">history</span>
      <h2 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-2">History</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] max-w-sm text-center">
        View session history and agent transcripts. Select a session from the sidebar to view its history.
      </p>
    </div>
  )
}
