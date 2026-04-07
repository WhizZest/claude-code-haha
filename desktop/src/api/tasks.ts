import { api } from './client'
import type { CronTask, CreateTaskInput, TaskRun } from '../types/task'

type TasksResponse = { tasks: CronTask[] }
type TaskResponse = { task: CronTask }
type RunsResponse = { runs: TaskRun[] }

export const tasksApi = {
  list() {
    return api.get<TasksResponse>('/api/scheduled-tasks')
  },

  create(input: CreateTaskInput) {
    return api.post<TaskResponse>('/api/scheduled-tasks', input)
  },

  update(id: string, updates: Partial<CronTask>) {
    return api.put<TaskResponse>(`/api/scheduled-tasks/${id}`, updates)
  },

  delete(id: string) {
    return api.delete<{ ok: true }>(`/api/scheduled-tasks/${id}`)
  },

  getRecentRuns(limit = 50) {
    return api.get<RunsResponse>(`/api/scheduled-tasks/runs?limit=${limit}`)
  },

  getTaskRuns(taskId: string) {
    return api.get<RunsResponse>(`/api/scheduled-tasks/${taskId}/runs`)
  },
}
