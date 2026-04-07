import { api } from './client'

type BrowseResult = {
  currentPath: string
  parentPath: string
  entries: Array<{
    name: string
    path: string
    isDirectory: boolean
  }>
}

export const filesystemApi = {
  browse(path?: string) {
    const params = path ? `?path=${encodeURIComponent(path)}` : ''
    return api.get<BrowseResult>(`/api/filesystem/browse${params}`)
  },
}
