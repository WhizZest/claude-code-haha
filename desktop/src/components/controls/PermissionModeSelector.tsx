import { useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useChatStore } from '../../stores/chatStore'
import type { PermissionMode } from '../../types/settings'

const PERMISSION_ITEMS: Array<{
  value: PermissionMode
  label: string
  description: string
  icon: string
  color?: string
}> = [
  {
    value: 'default',
    label: 'Ask permissions',
    description: 'Confirm file edits and higher-risk commands when CLI asks',
    icon: 'verified_user',
  },
  {
    value: 'acceptEdits',
    label: 'Auto accept edits',
    description: 'Claude writes to disk without asking',
    icon: 'bolt',
  },
  {
    value: 'plan',
    label: 'Plan mode',
    description: 'Architecture & reasoning only, no files',
    icon: 'architecture',
    color: 'text-[var(--color-text-tertiary)]',
  },
  {
    value: 'bypassPermissions',
    label: 'Bypass permissions',
    description: 'Full tool access for shell and file system',
    icon: 'gavel',
    color: 'text-[var(--color-error)]',
  },
]

const MODE_ICONS: Record<PermissionMode, string> = {
  default: 'verified_user',
  acceptEdits: 'bolt',
  plan: 'architecture',
  bypassPermissions: 'gavel',
  dontAsk: 'gavel',
}

const MODE_LABELS: Record<PermissionMode, string> = {
  default: 'Ask permissions',
  acceptEdits: 'Auto accept',
  plan: 'Plan mode',
  bypassPermissions: 'Bypass',
  dontAsk: 'Don\'t ask',
}

export function PermissionModeSelector() {
  const { permissionMode, setPermissionMode } = useSettingsStore()
  const setSessionPermissionMode = useChatStore((s) => s.setSessionPermissionMode)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-hover)] rounded-full text-xs font-medium text-[var(--color-text-secondary)] transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">{MODE_ICONS[permissionMode]}</span>
        <span>{MODE_LABELS[permissionMode]}</span>
        <span className="material-symbols-outlined text-[12px]">expand_more</span>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-[320px] rounded-xl bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] shadow-[var(--shadow-dropdown)] z-50 py-2">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
            Execution Permissions
          </div>
          {PERMISSION_ITEMS.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                void setPermissionMode(item.value)
                setSessionPermissionMode(item.value)
                setOpen(false)
              }}
              className={`
                w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                hover:bg-[var(--color-surface-hover)]
                ${item.value === permissionMode ? 'bg-[var(--color-surface-selected)]' : ''}
              `}
            >
              <span className={`material-symbols-outlined text-[20px] mt-0.5 ${item.color || 'text-[var(--color-text-secondary)]'}`}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{item.label}</div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{item.description}</div>
              </div>
              {item.value === permissionMode && (
                <span className="material-symbols-outlined text-[16px] text-[var(--color-brand)] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
