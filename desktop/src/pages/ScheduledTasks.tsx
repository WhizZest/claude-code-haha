import { useEffect, useState } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { useUIStore } from '../stores/uiStore'
import { Button } from '../components/shared/Button'
import { TaskList } from '../components/tasks/TaskList'
import { TaskEmptyState } from '../components/tasks/TaskEmptyState'
import { NewTaskModal } from '../components/tasks/NewTaskModal'

export function ScheduledTasks() {
  const { tasks, fetchTasks, isLoading } = useTaskStore()
  const { activeModal, openModal, closeModal } = useUIStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    fetchTasks().then(() => setInitialized(true))
  }, [fetchTasks])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-10 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Scheduled tasks</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Run tasks on a schedule or whenever you need them.
            </p>
          </div>
          <Button onClick={() => openModal('new-task')}>+ New task</Button>
        </div>

        {/* Content */}
        {!initialized && isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
          </div>
        ) : tasks.length === 0 ? (
          <TaskEmptyState onCreateTask={() => openModal('new-task')} />
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>

      {/* New Task Modal */}
      <NewTaskModal
        open={activeModal === 'new-task'}
        onClose={closeModal}
      />
    </div>
  )
}
