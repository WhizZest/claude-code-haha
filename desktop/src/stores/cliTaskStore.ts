import { create } from 'zustand'
import { cliTasksApi } from '../api/cliTasks'
import type { CLITask, TaskListSummary } from '../types/cliTask'

type CLITaskStore = {
  taskLists: TaskListSummary[]
  selectedListId: string | null
  tasks: CLITask[]
  isLoading: boolean

  fetchTaskLists: () => Promise<void>
  selectTaskList: (id: string) => Promise<void>
  clearSelection: () => void
}

export const useCLITaskStore = create<CLITaskStore>((set) => ({
  taskLists: [],
  selectedListId: null,
  tasks: [],
  isLoading: false,

  fetchTaskLists: async () => {
    set({ isLoading: true })
    try {
      const { lists } = await cliTasksApi.listTaskLists()
      set({ taskLists: lists, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  selectTaskList: async (id) => {
    set({ selectedListId: id, isLoading: true })
    try {
      const { tasks } = await cliTasksApi.getTasksForList(id)
      set({ tasks, isLoading: false })
    } catch {
      set({ tasks: [], isLoading: false })
    }
  },

  clearSelection: () => {
    set({ selectedListId: null, tasks: [] })
  },
}))
