import type { CronTask } from '../../types/task'
import { TaskRow } from './TaskRow'

type Props = {
  tasks: CronTask[]
}

export function TaskList({ tasks }: Props) {
  const enabledCount = tasks.filter((t) => t.enabled).length

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Tasks" value={String(tasks.length)} />
        <StatCard label="Active" value={String(enabledCount)} />
        <StatCard label="Disabled" value={String(tasks.length - enabledCount)} />
      </div>

      {/* Task rows */}
      <div className="flex flex-col">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-info)]">
      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
    </div>
  )
}
