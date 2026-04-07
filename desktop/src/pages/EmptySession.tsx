import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useUIStore } from '../stores/uiStore'
import { DirectoryPicker } from '../components/shared/DirectoryPicker'
import { PermissionModeSelector } from '../components/controls/PermissionModeSelector'
import { ModelSelector } from '../components/controls/ModelSelector'
import { AttachmentGallery } from '../components/chat/AttachmentGallery'
import {
  FALLBACK_SLASH_COMMANDS,
  findSlashToken,
  insertSlashTrigger,
  replaceSlashCommand,
} from '../components/chat/composerUtils'
import type { AttachmentRef } from '../types/chat'

type Attachment = {
  id: string
  name: string
  type: 'image' | 'file'
  mimeType?: string
  previewUrl?: string
  data?: string
}

export function EmptySession() {
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workDir, setWorkDir] = useState('')
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
  const createSession = useSessionStore((state) => state.createSession)
  const sendMessage = useChatStore((state) => state.sendMessage)
  const connectToSession = useChatStore((state) => state.connectToSession)
  const setActiveView = useUIStore((state) => state.setActiveView)
  const addToast = useUIStore((state) => state.addToast)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

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

  const filteredCommands = FALLBACK_SLASH_COMMANDS.filter((command) => {
    if (!slashFilter) return true
    const lower = slashFilter.toLowerCase()
    return command.name.toLowerCase().includes(lower) || command.description.toLowerCase().includes(lower)
  })

  useEffect(() => {
    setSlashSelectedIndex(0)
  }, [slashFilter])

  useEffect(() => {
    if (slashMenuOpen && slashItemRefs.current[slashSelectedIndex]) {
      slashItemRefs.current[slashSelectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [slashMenuOpen, slashSelectedIndex])

  const handleSubmit = async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || isSubmitting) return

    setIsSubmitting(true)
    try {
      const sessionId = await createSession(workDir || undefined)
      setActiveView('code')
      connectToSession(sessionId)
      const attachmentPayload: AttachmentRef[] = attachments.map((attachment) => ({
        type: attachment.type,
        name: attachment.name,
        data: attachment.data,
        mimeType: attachment.mimeType,
      }))
      sendMessage(text, attachmentPayload)
      setInput('')
      setAttachments([])
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create session',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (value: string, cursorPos: number) => {
    setInput(value)
    const token = findSlashToken(value, cursorPos)
    if (!token) {
      setSlashMenuOpen(false)
      return
    }
    setSlashFilter(token.filter)
    setSlashMenuOpen(true)
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
            mimeType: file.type || undefined,
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

  const selectSlashCommand = (command: string) => {
    const el = textareaRef.current
    if (!el) return
    const cursorPos = el.selectionStart ?? input.length
    const replacement = replaceSlashCommand(input, cursorPos, command)
    if (!replacement) return
    setInput(replacement.value)
    setSlashMenuOpen(false)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }

  const insertSlashCommand = () => {
    const el = textareaRef.current
    const cursorPos = el?.selectionStart ?? input.length
    const replacement = insertSlashTrigger(input, cursorPos)
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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#FAF9F5]">
      <div className="flex flex-1 flex-col items-center justify-center p-8 pb-32">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-6 h-24 w-24 opacity-40 grayscale contrast-125">
            <MascotIllustration />
          </div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-[#1B1C1A]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            New session
          </h1>
          <p className="mx-auto max-w-xs text-[#87736D]" style={{ fontFamily: "'Inter', sans-serif" }}>
            Start a fresh coding session. Claude is ready to help you build, debug, and architect your project.
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center px-8">
        <div className="flex w-full max-w-3xl flex-col gap-2">
          <div
            className="flex flex-col gap-3 rounded-xl border border-[#dac1ba]/15 bg-white p-4"
            style={{ boxShadow: '0 4px 20px rgba(27, 28, 26, 0.04), 0 12px 40px rgba(27, 28, 26, 0.08)' }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            {slashMenuOpen && filteredCommands.length > 0 && (
              <div
                ref={slashMenuRef}
                className="rounded-xl border border-[#dac1ba]/20 bg-white shadow-[0_18px_48px_rgba(27,28,26,0.12)]"
              >
                <div className="max-h-[260px] overflow-y-auto py-1">
                  {filteredCommands.map((command, index) => (
                    <button
                      key={command.name}
                      ref={(el) => { slashItemRefs.current[index] = el }}
                      onClick={() => selectSlashCommand(command.name)}
                      onMouseEnter={() => setSlashSelectedIndex(index)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                        index === slashSelectedIndex ? 'bg-[#F4F4F0]' : 'hover:bg-[#F8F7F4]'
                      }`}
                    >
                      <span className="text-sm font-semibold text-[#1B1C1A]">/{command.name}</span>
                      <span className="truncate text-xs text-[#87736D]">{command.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {attachments.length > 0 && (
              <AttachmentGallery attachments={attachments} variant="composer" onRemove={removeAttachment} />
            )}

            <div className="flex items-start gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => handleInputChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="flex-1 resize-none border-none bg-transparent py-2 leading-relaxed text-[#1B1C1A] outline-none placeholder:text-[#87736D]/50"
                style={{ fontFamily: "'Inter', sans-serif" }}
                placeholder="Ask anything..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between border-t border-[#dac1ba]/10 pt-3">
              <div className="flex items-center gap-2">
                <div ref={plusMenuRef} className="relative">
                  <button
                    onClick={() => setPlusMenuOpen((prev) => !prev)}
                    aria-label="Open composer tools"
                    className="rounded-lg p-1.5 text-[#87736D] transition-colors hover:bg-[#F4F4F0]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>

                  {plusMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-[240px] rounded-xl border border-[#dac1ba]/20 bg-white py-1 shadow-[0_18px_48px_rgba(27,28,26,0.12)]">
                      <button
                        onClick={() => {
                          fileInputRef.current?.click()
                          setPlusMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#1B1C1A] transition-colors hover:bg-[#F8F7F4]"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#87736D]">attach_file</span>
                        Add files or photos
                      </button>
                      <button
                        onClick={insertSlashCommand}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#1B1C1A] transition-colors hover:bg-[#F8F7F4]"
                      >
                        <span className="w-5 text-center text-[18px] font-bold text-[#87736D]">/</span>
                        Slash commands
                      </button>
                    </div>
                  )}
                </div>

                <PermissionModeSelector />
              </div>

              <div className="flex items-center gap-3">
                <ModelSelector />
                <button
                  onClick={handleSubmit}
                  disabled={(!input.trim() && attachments.length === 0) || isSubmitting}
                  className="flex w-[112px] items-center justify-center gap-1 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-30"
                >
                  Run
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <DirectoryPicker value={workDir} onChange={setWorkDir} />
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
    </div>
  )
}

function MascotIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="24" y="30" width="48" height="36" rx="8" fill="#C47A5A" />
      <rect x="28" y="18" width="40" height="16" rx="6" fill="#B86B4A" />
      <line x1="48" y1="10" x2="48" y2="18" stroke="#A0796A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="48" cy="8" r="3" fill="#D4936F" />
      <circle cx="40" cy="26" r="2.5" fill="#1B1C1A" />
      <circle cx="56" cy="26" r="2.5" fill="#1B1C1A" />
      <circle cx="41" cy="25" r="1" fill="white" opacity="0.7" />
      <circle cx="57" cy="25" r="1" fill="white" opacity="0.7" />
      <path d="M43 31 Q48 35 53 31" stroke="#1B1C1A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <rect x="36" y="40" width="24" height="16" rx="4" fill="#D4936F" opacity="0.5" />
      <line x1="40" y1="44" x2="56" y2="44" stroke="#B86B4A" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <line x1="40" y1="48" x2="56" y2="48" stroke="#B86B4A" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <line x1="40" y1="52" x2="52" y2="52" stroke="#B86B4A" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <rect x="14" y="36" width="10" height="22" rx="5" fill="#C47A5A" />
      <rect x="72" y="36" width="10" height="22" rx="5" fill="#C47A5A" />
      <rect x="32" y="66" width="12" height="16" rx="5" fill="#C47A5A" />
      <rect x="52" y="66" width="12" height="16" rx="5" fill="#C47A5A" />
      <rect x="30" y="78" width="16" height="6" rx="3" fill="#B86B4A" />
      <rect x="50" y="78" width="16" height="6" rx="3" fill="#B86B4A" />
      <rect x="28" y="30" width="40" height="4" rx="2" fill="#D4936F" opacity="0.3" />
    </svg>
  )
}
