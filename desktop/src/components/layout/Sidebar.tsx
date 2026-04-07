import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useUIStore } from '../../stores/uiStore'
import { ProjectFilter } from './ProjectFilter'
import type { SessionListItem } from '../../types/session'

type TimeGroup = 'Today' | 'Yesterday' | 'Last 7 days' | 'Last 30 days' | 'Older'

const TIME_GROUP_ORDER: TimeGroup[] = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Older']

export function Sidebar() {
  const { sessions, activeSessionId, selectedProjects, setActiveSession, fetchSessions, deleteSession, renameSession } = useSessionStore()
  const { activeView, setActiveView } = useUIStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  // Filter by selected projects, then by search query
  const filteredSessions = useMemo(() => {
    let result = sessions
    if (selectedProjects.length > 0) {
      result = result.filter((s) => selectedProjects.includes(s.projectPath))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((s) => s.title.toLowerCase().includes(q))
    }
    return result
  }, [sessions, selectedProjects, searchQuery])

  // Group by time
  const timeGroups = useMemo(() => groupByTime(filteredSessions), [filteredSessions])

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ id, x: e.clientX, y: e.clientY })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setContextMenu(null)
    await deleteSession(id)
  }, [deleteSession])

  const handleStartRename = useCallback((id: string, currentTitle: string) => {
    setContextMenu(null)
    setRenamingId(id)
    setRenameValue(currentTitle)
  }, [])

  const handleFinishRename = useCallback(async () => {
    if (renamingId && renameValue.trim()) {
      await renameSession(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, renameSession])

  return (
    <aside className="w-[var(--sidebar-width)] h-full flex flex-col bg-[var(--color-surface-sidebar)] border-r border-[var(--color-border)] select-none">
      {/* Navigation */}
      <div className="p-3 flex flex-col gap-0.5">
        <NavItem
          active={activeView === 'code' && !activeSessionId}
          onClick={() => { setActiveView('code'); setActiveSession(null) }}
          icon={<PlusIcon />}
        >
          New session
        </NavItem>
        <NavItem
          active={activeView === 'scheduled'}
          onClick={() => setActiveView('scheduled')}
          icon={<ClockIcon />}
        >
          Scheduled
        </NavItem>
        <NavItem
          active={activeView === 'tasks'}
          onClick={() => setActiveView('tasks')}
          icon={<TaskIcon />}
        >
          Tasks
        </NavItem>
      </div>

      {/* Project filter */}
      <div className="px-3 pb-1 flex items-center justify-between">
        <ProjectFilter />
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <input
          id="sidebar-search"
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 px-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-focus)]"
        />
      </div>

      {/* Session list — grouped by time */}
      <div className="flex-1 overflow-y-auto px-3">
        {filteredSessions.length === 0 && (
          <div className="px-3 py-4 text-xs text-[var(--color-text-tertiary)] text-center">
            {searchQuery ? 'No matching sessions' : 'No sessions yet'}
          </div>
        )}
        {TIME_GROUP_ORDER.map((group) => {
          const items = timeGroups.get(group)
          if (!items || items.length === 0) return null
          return (
            <div key={group} className="mb-1">
              <div className="px-2 pt-3 pb-1 text-[11px] font-semibold text-[var(--color-text-tertiary)] tracking-wide">
                {group}
              </div>
              {items.map((session) => (
                <div key={session.id} className="relative">
                  {renamingId === session.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename()
                        if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                      }}
                      className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--color-border-focus)] bg-[var(--color-surface)] text-[var(--color-text-primary)] outline-none ml-1"
                    />
                  ) : (
                    <button
                      onClick={() => { setActiveView('code'); setActiveSession(session.id) }}
                      onContextMenu={(e) => handleContextMenu(e, session.id)}
                      className={`
                        w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-sm text-left rounded-[var(--radius-md)] transition-colors duration-200 group
                        ${session.id === activeSessionId
                          ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                        }
                      `}
                    >
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{
                        backgroundColor: session.id === activeSessionId ? 'var(--color-brand)' : 'var(--color-text-tertiary)',
                        opacity: session.id === activeSessionId ? 1 : 0.5,
                      }} />
                      <span className="truncate flex-1">{session.title || 'Untitled'}</span>
                      {!session.workDirExists && (
                        <span
                          className="text-[10px] text-[var(--color-warning)] flex-shrink-0"
                          title={session.workDir ?? 'Missing workspace'}
                        >
                          missing dir
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-tertiary)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatRelativeTime(session.modifiedAt)}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Settings button at bottom */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <NavItem
          active={activeView === 'settings'}
          onClick={() => setActiveView('settings')}
          icon={<span className="material-symbols-outlined text-[18px]">settings</span>}
        >
          Settings
        </NavItem>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: 'var(--shadow-dropdown)' }}
        >
          <button
            onClick={() => {
              const session = sessions.find(s => s.id === contextMenu.id)
              handleStartRename(contextMenu.id, session?.title || '')
            }}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Rename
          </button>
          <button
            onClick={() => handleDelete(contextMenu.id)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-error)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}

function groupByTime(sessions: SessionListItem[]): Map<TimeGroup, SessionListItem[]> {
  const groups = new Map<TimeGroup, SessionListItem[]>()
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86400000
  const sevenDaysAgo = startOfToday - 7 * 86400000
  const thirtyDaysAgo = startOfToday - 30 * 86400000

  for (const session of sessions) {
    const ts = new Date(session.modifiedAt).getTime()
    let group: TimeGroup
    if (ts >= startOfToday) group = 'Today'
    else if (ts >= startOfYesterday) group = 'Yesterday'
    else if (ts >= sevenDaysAgo) group = 'Last 7 days'
    else if (ts >= thirtyDaysAgo) group = 'Last 30 days'
    else group = 'Older'

    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(session)
  }

  return groups
}

function NavItem({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-[var(--radius-md)] transition-colors duration-200
        ${active
          ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)] font-medium'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
        }
      `}
    >
      {icon}
      {children}
    </button>
  )
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d`
  return `${Math.floor(day / 30)}mo`
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}
