import type { CronTask } from '../../types/task'
import { useTaskStore } from '../../stores/taskStore'

type Props = {
  task: CronTask
}

export function TaskRow({ task }: Props) {
  const { deleteTask, updateTask } = useTaskStore()

  const toggleEnabled = () => {
    updateTask(task.id, { enabled: !task.enabled })
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)] hover:bg-[var(--color-surface-hover)] transition-colors group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Status indicator */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'}`} />

        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{task.name}</div>
          {task.description && (
            <div className="text-xs text-[var(--color-text-secondary)] truncate">{task.description}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Cron expression */}
        <span className="text-xs text-[var(--color-text-tertiary)] font-[var(--font-mono)]">{task.cron}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleEnabled}
            className="px-2 py-1 text-xs rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-selected)] transition-colors"
          >
            {task.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => deleteTask(task.id)}
            className="px-2 py-1 text-xs rounded-[var(--radius-sm)] text-[var(--color-error)] hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
