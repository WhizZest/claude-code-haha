import { useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useUIStore } from '../stores/uiStore'

export function useKeyboardShortcuts() {
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const closeModal = useUIStore((s) => s.closeModal)
  const activeModal = useUIStore((s) => s.activeModal)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const chatState = useChatStore((s) => s.chatState)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      // Cmd+N — New session
      if (meta && e.key === 'n') {
        e.preventDefault()
        setActiveSession(null)
        setActiveView('code')
      }

      // Cmd+K — Focus search (sidebar search input)
      if (meta && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('aside input[type="text"]') as HTMLInputElement
        searchInput?.focus()
      }

      // Escape — Close modal or clear state
      if (e.key === 'Escape') {
        if (activeModal) {
          closeModal()
        }
      }

      // Cmd+. — Stop generation
      if (meta && e.key === '.') {
        if (chatState !== 'idle') {
          e.preventDefault()
          stopGeneration()
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeModal, chatState, closeModal, setActiveSession, setActiveView, stopGeneration])
}
