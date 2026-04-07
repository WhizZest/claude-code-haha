import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { ContentRouter } from './ContentRouter'
import { ToastContainer } from '../shared/Toast'
import { useSettingsStore } from '../../stores/settingsStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

export function AppShell() {
  const fetchSettings = useSettingsStore((s) => s.fetchAll)

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useKeyboardShortcuts()

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <ContentRouter />
      </main>
      <ToastContainer />
    </div>
  )
}
