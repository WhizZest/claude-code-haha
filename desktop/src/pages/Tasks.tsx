import { useEffect } from 'react'
import { useCLITaskStore } from '../stores/cliTaskStore'
import type { CLITask, TaskListSummary } from '../types/cliTask'

export function Tasks() {
  const { taskLists, selectedListId, tasks, isLoading, fetchTaskLists, selectTaskList, clearSelection } = useCLITaskStore()

  useEffect(() => { fetchTaskLists() }, [fetchTaskLists])

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar: task lists */}
      <div className="w-64 border-r border-[var(--color-border)] flex flex-col overflow-hidden bg-[var(--color-surface)]">
        <div className="px-4 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Task Lists</h2>
          <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">CLI task tracking sessions</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading && taskLists.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-4 h-4 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
            </div>
          ) : taskLists.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-[28px] text-[var(--color-text-tertiary)] block mb-2">task_alt</span>
              <p className="text-xs text-[var(--color-text-tertiary)]">No task lists found</p>
            </div>
          ) : (
            taskLists.map((list) => (
              <TaskListItem
                key={list.id}
                list={list}
                selected={selectedListId === list.id}
                onClick={() => selectTaskList(list.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main: task details */}
      <div className="flex-1 overflow-y-auto bg-[var(--color-surface)]">
        {selectedListId ? (
          <TaskListDetail
            listId={selectedListId}
            tasks={tasks}
            isLoading={isLoading}
            onBack={clearSelection}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="material-symbols-outlined text-[48px] text-[var(--color-text-tertiary)] mb-3">checklist</span>
            <p className="text-sm text-[var(--color-text-secondary)]">Select a task list to view tasks</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{taskLists.length} task list{taskLists.length !== 1 ? 's' : ''} available</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Task List Item ─────────────────────────────────────────

function TaskListItem({ list, selected, onClick }: { list: TaskListSummary; selected: boolean; onClick: () => void }) {
  const isTeamOrNamed = !list.id.match(/^[0-9a-f]{8}-/)
  const displayName = isTeamOrNamed ? list.id : list.id.slice(0, 8) + '...'

  const progressPercent = list.taskCount > 0
    ? Math.round((list.completedCount / list.taskCount) * 100)
    : 0

  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col gap-1 px-4 py-2.5 text-left transition-colors ${
        selected
          ? 'bg-[var(--color-surface-selected)]'
          : 'hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px] text-[var(--color-text-tertiary)]">
          {isTeamOrNamed ? 'group' : 'terminal'}
        </span>
        <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">{displayName}</span>
      </div>
      <div className="flex items-center gap-2 ml-5">
        {/* Mini progress bar */}
        <div className="flex-1 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-success)] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] text-[var(--color-text-tertiary)] flex-shrink-0">
          {list.completedCount}/{list.taskCount}
        </span>
      </div>
    </button>
  )
}

// ─── Task List Detail ──────────────────────────────────────

function TaskListDetail({ listId, tasks, isLoading, onBack }: {
  listId: string
  tasks: CLITask[]
  isLoading: boolean
  onBack: () => void
}) {
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length
  const pendingCount = tasks.filter((t) => t.status === 'pending').length

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-secondary)] lg:hidden">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-[var(--color-text-primary)] truncate">{listId}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-tertiary)]">
            <span>{tasks.length} tasks</span>
            {completedCount > 0 && <StatusBadge status="completed" count={completedCount} />}
            {inProgressCount > 0 && <StatusBadge status="in_progress" count={inProgressCount} />}
            {pendingCount > 0 && <StatusBadge status="pending" count={pendingCount} />}
          </div>
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--color-text-tertiary)]">No tasks in this list</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} allTasks={tasks} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Task Card ──────────────────────────────────────────────

function TaskCard({ task, allTasks }: { task: CLITask; allTasks: CLITask[] }) {
  const statusConfig = {
    pending: { icon: 'radio_button_unchecked', color: 'text-[var(--color-text-tertiary)]', bg: '' },
    in_progress: { icon: 'pending', color: 'text-[var(--color-warning)]', bg: 'bg-amber-50/50' },
    completed: { icon: 'check_circle', color: 'text-[var(--color-success)]', bg: '' },
  }

  const config = statusConfig[task.status]

  // Resolve blocker names
  const blockerNames = task.blockedBy
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => `#${t!.id} ${t!.subject}`)

  const blockingNames = task.blocks
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean)
    .map((t) => `#${t!.id}`)

  return (
    <div className={`flex gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] transition-colors hover:border-[var(--color-border-focus)] ${config.bg}`}>
      {/* Status icon */}
      <span className={`material-symbols-outlined text-[20px] mt-0.5 flex-shrink-0 ${config.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
        {config.icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">#{task.id}</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{task.subject}</span>
        </div>

        {task.description && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{task.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {task.owner && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]">
              <span className="material-symbols-outlined text-[12px]">person</span>
              {task.owner}
            </span>
          )}
          {task.blockedBy.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-error)]" title={blockerNames.join(', ')}>
              <span className="material-symbols-outlined text-[12px]">block</span>
              blocked by {task.blockedBy.map((id) => `#${id}`).join(', ')}
            </span>
          )}
          {task.blocks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)]" title={blockingNames.join(', ')}>
              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              blocks {blockingNames.join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge ───────────────────────────────────────────

function StatusBadge({ status, count }: { status: string; count: number }) {
  const styles: Record<string, string> = {
    completed: 'text-[var(--color-success)]',
    in_progress: 'text-[var(--color-warning)]',
    pending: 'text-[var(--color-text-tertiary)]',
  }

  const labels: Record<string, string> = {
    completed: 'done',
    in_progress: 'active',
    pending: 'pending',
  }

  return (
    <span className={`${styles[status] || ''}`}>
      {count} {labels[status] || status}
    </span>
  )
}
