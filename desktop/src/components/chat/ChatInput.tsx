import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { sessionsApi } from '../../api/sessions'
import { PermissionModeSelector } from '../controls/PermissionModeSelector'
import { ModelSelector } from '../controls/ModelSelector'
import type { AttachmentRef } from '../../types/chat'
import { AttachmentGallery } from './AttachmentGallery'
import { ProjectContextChip } from '../shared/ProjectContextChip'
import {
  FALLBACK_SLASH_COMMANDS,
  findSlashTrigger,
  replaceSlashToken,
} from './composerUtils'

type GitInfo = { branch: string | null; repoName: string | null; workDir: string; changedFiles: number }

type Attachment = {
  id: string
  name: string
  type: 'image' | 'file'
  mimeType?: string
  previewUrl?: string
  data?: string
}

export function ChatInput() {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const slashItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { sendMessage, chatState, stopGeneration, slashCommands } = useChatStore()
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const activeSession = useSessionStore((state) => state.sessions.find((session) => session.id === state.activeSessionId) ?? null)
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)

  const isActive = chatState !== 'idle'
  const isWorkspaceMissing = activeSession?.workDirExists === false
  const canSubmit = !isWorkspaceMissing && (input.trim().length > 0 || attachments.length > 0)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [isActive])

  useEffect(() => {
    if (!activeSessionId) {
      setGitInfo(null)
      return
    }
    sessionsApi.getGitInfo(activeSessionId).then(setGitInfo).catch(() => setGitInfo(null))
  }, [activeSessionId])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  useEffect(() => {
    if (!plusMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [plusMenuOpen])

  useEffect(() => {
    if (!slashMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setSlashMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [slashMenuOpen])

  const filteredCommands = useMemo(() => {
    const source = slashCommands.length > 0 ? slashCommands : FALLBACK_SLASH_COMMANDS
    if (!slashFilter) return source
    const lower = slashFilter.toLowerCase()
    return source.filter((command) => (
      command.name.toLowerCase().includes(lower) ||
      command.description.toLowerCase().includes(lower)
    ))
  }, [slashCommands, slashFilter])

  useEffect(() => {
    setSlashSelectedIndex(0)
  }, [slashFilter])

  useEffect(() => {
    if (slashMenuOpen && slashItemRefs.current[slashSelectedIndex]) {
      slashItemRefs.current[slashSelectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [slashMenuOpen, slashSelectedIndex])

  const detectSlashTrigger = useCallback((value: string, cursorPos: number) => {
    const token = findSlashTrigger(value, cursorPos)
    if (!token) {
      setSlashMenuOpen(false)
      return
    }

    setSlashFilter(token.filter)
    setSlashMenuOpen(true)
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    setInput(value)
    detectSlashTrigger(value, event.target.selectionStart ?? value.length)
  }

  const selectSlashCommand = useCallback((command: string) => {
    const el = textareaRef.current
    if (!el) return
    const cursorPos = el.selectionStart ?? input.length
    const replacement = replaceSlashToken(input, cursorPos, command)
    setInput(replacement.value)
    setSlashMenuOpen(false)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }, [input])

  const handleSubmit = () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || isWorkspaceMissing) return

    const attachmentPayload: AttachmentRef[] = attachments.map((attachment) => ({
      type: attachment.type,
      name: attachment.name,
      data: attachment.data,
      mimeType: attachment.mimeType,
    }))

    sendMessage(text, attachmentPayload)
    setInput('')
    setAttachments([])
    setSlashMenuOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = filteredCommands[slashSelectedIndex]
        if (selected) selectSlashCommand(selected.name)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashMenuOpen(false)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items
    if (!items) return

    let hasImage = false
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item || !item.type.startsWith('image/')) continue

      hasImage = true
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            name: `pasted-image-${Date.now()}.png`,
            type: 'image',
            mimeType: file.type || 'image/png',
            previewUrl: reader.result as string,
            data: reader.result as string,
          },
        ])
      }
      reader.readAsDataURL(file)
    }

    if (!hasImage) return
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const isImage = file.type.startsWith('image/')
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            type: isImage ? 'image' : 'file',
            mimeType: file.type || undefined,
            previewUrl: isImage ? (reader.result as string) : undefined,
            data: reader.result as string,
          },
        ])
      }
      reader.readAsDataURL(file)
    })

    event.target.value = ''
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    if (files.length > 0) {
      const fakeEvent = { target: { files } } as React.ChangeEvent<HTMLInputElement>
      handleFileSelect(fakeEvent)
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
  }

  const insertSlashCommand = () => {
    const el = textareaRef.current
    const cursorPos = el?.selectionStart ?? input.length
    const replacement = replaceSlashToken(input, cursorPos, '', { trailingSpace: false })
    setInput(replacement.value)
    setPlusMenuOpen(false)
    setSlashFilter('')
    setSlashMenuOpen(true)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }

  return (
    <div className="bg-[#FAF9F5] px-4 py-4">
      <div className="mx-auto max-w-[860px]">
        <div
          className="relative rounded-xl border border-[#dac1ba]/15 bg-white p-4 transition-colors focus-within:border-[var(--color-border-focus)]"
          style={{ boxShadow: '0 4px 20px rgba(27, 28, 26, 0.04), 0 12px 40px rgba(27, 28, 26, 0.08)' }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          {slashMenuOpen && filteredCommands.length > 0 && (
            <div
              ref={slashMenuRef}
              className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] shadow-[var(--shadow-dropdown)]"
            >
              <div className="max-h-[300px] overflow-y-auto py-1">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.name}
                    ref={(el) => { slashItemRefs.current[index] = el }}
                    onClick={() => selectSlashCommand(command.name)}
                    onMouseEnter={() => setSlashSelectedIndex(index)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                      index === slashSelectedIndex
                        ? 'bg-[var(--color-surface-hover)]'
                        : 'hover:bg-[var(--color-surface-hover)]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-sm font-semibold text-[var(--color-text-primary)]">
                        /{command.name}
                      </span>
                    </div>
                    <span className="truncate text-right text-xs text-[var(--color-text-tertiary)]">
                      {command.description}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-tertiary)]">
                <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-1.5 py-0.5 font-mono text-[10px]">Up/Down</kbd>
                <span>navigate</span>
                <kbd className="ml-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                <span>select</span>
                <kbd className="ml-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
                <span>dismiss</span>
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="px-3 pt-3">
              <AttachmentGallery attachments={attachments} variant="composer" onRemove={removeAttachment} />
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isWorkspaceMissing
                ? 'This session points to a missing workspace. Create a new session or pick another project.'
                : 'Ask Claude to edit, debug or explain...'
            }
            disabled={isWorkspaceMissing}
            rows={1}
            className="w-full resize-none bg-transparent py-2 pb-12 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] disabled:opacity-50"
          />

          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-[#dac1ba]/10 px-3 py-3">
            <div className="flex items-center gap-2">
              <div ref={plusMenuRef} className="relative">
                <button
                  onClick={() => setPlusMenuOpen((value) => !value)}
                  aria-label="Open composer tools"
                  className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[#F4F4F0]"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>

                {plusMenuOpen && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-[240px] rounded-xl border border-[#dac1ba]/20 bg-white py-1 shadow-[0_18px_48px_rgba(27,28,26,0.12)]">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click()
                        setPlusMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F8F7F4]"
                    >
                      <span className="material-symbols-outlined text-[18px] text-[var(--color-text-secondary)]">attach_file</span>
                      <span className="text-sm text-[var(--color-text-primary)]">Add files or photos</span>
                    </button>
                    <button
                      onClick={insertSlashCommand}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#F8F7F4]"
                    >
                      <span className="w-[24px] text-center text-[18px] font-bold text-[var(--color-text-secondary)]">/</span>
                      <span className="text-sm text-[var(--color-text-primary)]">Slash commands</span>
                    </button>
                  </div>
                )}
              </div>

              <PermissionModeSelector />
            </div>

            <div className="flex items-center gap-2">
              <ModelSelector />
              <button
                onClick={isActive ? stopGeneration : handleSubmit}
                disabled={!isActive && !canSubmit}
                title={isActive ? 'Stop generation (Cmd+.)' : undefined}
                className={`flex w-[112px] items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-30 ${
                  isActive ? 'bg-[var(--color-error)]' : 'bg-[var(--color-brand)]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isActive ? 'stop' : 'arrow_forward'}
                </span>
                {isActive ? 'Stop' : 'Run'}
              </button>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

        <div className="mt-3 px-1">
          <ProjectContextChip
            workDir={gitInfo?.workDir || activeSession?.workDir}
            repoName={gitInfo?.repoName || null}
            branch={gitInfo?.branch || null}
          />
        </div>
      </div>
    </div>
  )
}
