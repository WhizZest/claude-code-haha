import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, type TranslationKey } from '../i18n'
import { terminalApi } from '../api/terminal'
import { useSettingsStore } from '../stores/settingsStore'
import { Dropdown } from '../components/shared/Dropdown'
import { Input } from '../components/shared/Input'
import { Button } from '../components/shared/Button'
import type { DesktopTerminalStartupShell } from '../types/settings'
import {
  attachTerminalRuntime,
  createLocalTerminalRuntimeId,
  destroyTerminalRuntime,
  getTerminalRuntime,
  subscribeTerminalRuntime,
  updateTerminalRuntime,
  type TerminalRuntime,
  type TerminalStatus,
} from '../lib/terminalRuntime'

const STATUS_LABEL_KEYS: Record<TerminalStatus, TranslationKey> = {
  idle: 'settings.terminal.status.idle',
  starting: 'settings.terminal.status.starting',
  running: 'settings.terminal.status.running',
  exited: 'settings.terminal.status.exited',
  error: 'settings.terminal.status.error',
  unavailable: 'settings.terminal.status.unavailable',
}

type TerminalSettingsProps = {
  active?: boolean
  cwd?: string
  onNewTerminal?: () => void
  onOpenInTab?: () => void
  onClose?: () => void
  testId?: string
  workspace?: boolean
  docked?: boolean
  showPreferences?: boolean
  runtimeId?: string
  preserveOnUnmount?: boolean
}

export function TerminalSettings({
  active = true,
  cwd,
  onNewTerminal,
  onOpenInTab,
  onClose,
  testId = 'settings-terminal-host',
  workspace = false,
  docked = false,
  showPreferences = false,
  runtimeId,
  preserveOnUnmount = false,
}: TerminalSettingsProps = {}) {
  const t = useTranslation()
  const desktopTerminal = useSettingsStore((state) => state.desktopTerminal)
  const setDesktopTerminal = useSettingsStore((state) => state.setDesktopTerminal)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const localRuntimeIdRef = useRef<string | null>(null)
  if (!localRuntimeIdRef.current) {
    localRuntimeIdRef.current = runtimeId ?? createLocalTerminalRuntimeId()
  }
  const effectiveRuntimeId = runtimeId ?? localRuntimeIdRef.current
  const runtimeRef = useRef<TerminalRuntime | null>(null)
  if (!runtimeRef.current || runtimeRef.current.id !== effectiveRuntimeId) {
    runtimeRef.current = getTerminalRuntime(effectiveRuntimeId, terminalApi.isAvailable() ? 'idle' : 'unavailable')
  }
  const runtime = runtimeRef.current
  const [, forceRuntimeUpdate] = useState(0)
  const status = runtime.status
  const error = runtime.error
  const shellInfo = runtime.shellInfo
  const [startupShell, setStartupShell] = useState<DesktopTerminalStartupShell>(desktopTerminal?.startupShell ?? 'system')
  const [customShellPath, setCustomShellPath] = useState(desktopTerminal?.customShellPath ?? '')
  const [preferencesError, setPreferencesError] = useState<string | null>(null)
  const [preferencesSaved, setPreferencesSaved] = useState(false)
  const [preferencesSaving, setPreferencesSaving] = useState(false)
  const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent)

  useEffect(() => {
    return subscribeTerminalRuntime(runtime, () => forceRuntimeUpdate((value) => value + 1))
  }, [runtime])

  useEffect(() => {
    setStartupShell(desktopTerminal?.startupShell ?? 'system')
    setCustomShellPath(desktopTerminal?.customShellPath ?? '')
  }, [desktopTerminal])

  useEffect(() => {
    if (!preferencesSaved) return
    const timer = window.setTimeout(() => setPreferencesSaved(false), 2500)
    return () => window.clearTimeout(timer)
  }, [preferencesSaved])

  const shellItems = useMemo(() => [
    {
      value: 'system' as const,
      label: t('settings.terminal.shell.system'),
      description: t('settings.terminal.shell.systemDesc'),
    },
    {
      value: 'pwsh' as const,
      label: t('settings.terminal.shell.pwsh'),
      description: t('settings.terminal.shell.pwshDesc'),
    },
    {
      value: 'powershell' as const,
      label: t('settings.terminal.shell.powershell'),
      description: t('settings.terminal.shell.powershellDesc'),
    },
    {
      value: 'cmd' as const,
      label: t('settings.terminal.shell.cmd'),
      description: t('settings.terminal.shell.cmdDesc'),
    },
    {
      value: 'custom' as const,
      label: t('settings.terminal.shell.custom'),
      description: t('settings.terminal.shell.customDesc'),
    },
  ], [t])

  const resizeSession = useCallback(() => {
    const terminal = runtime.terminal
    const fit = runtime.fit
    const sessionId = runtime.nativeSessionId
    if (!terminal || !fit) return

    fit.fit()
    if (sessionId) {
      void terminalApi.resize(sessionId, terminal.cols, terminal.rows).catch(() => {})
    }
  }, [runtime])

  const startTerminal = useCallback(async () => {
    if (!terminalApi.isAvailable()) {
      updateTerminalRuntime(runtime, { status: 'unavailable' })
      return
    }

    const host = hostRef.current
    if (!host) return

    updateTerminalRuntime(runtime, { error: null, status: 'starting', shellInfo: null })

    const existing = runtime.nativeSessionId
    if (existing) {
      await terminalApi.kill(existing).catch(() => {})
      runtime.nativeSessionId = null
    }
    runtime.dataDisposable?.dispose()
    runtime.dataDisposable = null
    runtime.unlisteners.forEach((unlisten) => unlisten())
    runtime.unlisteners = []

    runtime.terminal?.dispose()
    runtime.terminal = null
    runtime.fit = null
    host.innerHTML = ''

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ])

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: false,
      fontFamily: "var(--font-mono), 'SFMono-Regular', Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 4000,
      theme: {
        background: '#121212',
        foreground: '#d7d2d0',
        cursor: '#ffb59f',
        selectionBackground: '#5f4a40',
        black: '#1f1f1f',
        red: '#ff6d67',
        green: '#7ef18a',
        yellow: '#f8c55f',
        blue: '#77a8ff',
        magenta: '#d699ff',
        cyan: '#61d6d6',
        white: '#d7d2d0',
        brightBlack: '#8f8683',
        brightRed: '#ff8a85',
        brightGreen: '#9ff7a7',
        brightYellow: '#ffdd7a',
        brightBlue: '#a6c5ff',
        brightMagenta: '#e3b8ff',
        brightCyan: '#8ceeee',
        brightWhite: '#ffffff',
      },
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host)
    updateTerminalRuntime(runtime, { terminal, fit })
    fit.fit()

    const outputUnlisten = await terminalApi.onOutput((payload) => {
      if (payload.session_id === runtime.nativeSessionId) {
        terminal.write(payload.data)
      }
    })
    const exitUnlisten = await terminalApi.onExit((payload) => {
      if (payload.session_id !== runtime.nativeSessionId) return
      updateTerminalRuntime(runtime, { status: 'exited' })
      const signal = payload.signal ? `, ${payload.signal}` : ''
      terminal.writeln(`\r\n[process exited: ${payload.code}${signal}]`)
      updateTerminalRuntime(runtime, { nativeSessionId: null })
    })
    runtime.unlisteners = [outputUnlisten, exitUnlisten]

    runtime.dataDisposable = terminal.onData((data) => {
      const sessionId = runtime.nativeSessionId
      if (sessionId) {
        void terminalApi.write(sessionId, data).catch((err) => {
          updateTerminalRuntime(runtime, {
            error: err instanceof Error ? err.message : String(err),
            status: 'error',
          })
        })
      }
    })

    try {
      const result = await terminalApi.spawn({
        cols: terminal.cols,
        rows: terminal.rows,
        ...(cwd ? { cwd } : {}),
      })
      updateTerminalRuntime(runtime, {
        nativeSessionId: result.session_id,
        shellInfo: { shell: result.shell, cwd: result.cwd },
        status: 'running',
      })
      resizeSession()
    } catch (err) {
      outputUnlisten()
      exitUnlisten()
      terminal.dispose()
      updateTerminalRuntime(runtime, {
        terminal: null,
        fit: null,
        error: err instanceof Error ? err.message : String(err),
        status: 'error',
      })
    }
  }, [cwd, resizeSession, runtime])

  useEffect(() => {
    if (!terminalApi.isAvailable()) return
    if (runtime.terminal) {
      if (hostRef.current) {
        attachTerminalRuntime(runtime, hostRef.current)
      }
      resizeSession()
    } else {
      void startTerminal()
    }

    const observer = new ResizeObserver(() => resizeSession())
    if (hostRef.current) observer.observe(hostRef.current)

    return () => {
      observer.disconnect()
      if (!preserveOnUnmount) {
        destroyTerminalRuntime(runtime.id)
      }
    }
  }, [preserveOnUnmount, resizeSession, runtime, startTerminal])

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => resizeSession())
    }
  }, [active, resizeSession])

  const clearTerminal = () => {
    runtime.terminal?.clear()
  }

  const savePreferences = async () => {
    setPreferencesError(null)
    setPreferencesSaved(false)

    const trimmedPath = customShellPath.trim()
    if (startupShell === 'custom') {
      if (!trimmedPath) {
        setPreferencesError(t('settings.terminal.customPathRequired'))
        return
      }
      if (!/^[A-Za-z]:[\\/]/.test(trimmedPath)) {
        setPreferencesError(t('settings.terminal.customPathAbsolute'))
        return
      }
    }

    setPreferencesSaving(true)
    try {
      await setDesktopTerminal({
        startupShell,
        customShellPath: trimmedPath,
      })
      setPreferencesSaved(true)
    } catch (err) {
      setPreferencesError(err instanceof Error ? err.message : String(err))
    } finally {
      setPreferencesSaving(false)
    }
  }

  return (
    <div className={`flex h-full flex-col overflow-hidden ${
      docked
        ? 'min-h-0 bg-[var(--color-surface-container-lowest)] px-3 py-2'
        : workspace
          ? 'min-h-0 bg-[var(--color-surface)] px-5 py-4'
          : 'min-h-[620px]'
    }`}>
      <div className={`${docked ? 'mb-2' : 'mb-3'} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0">
          <h2 className={`${docked ? 'text-sm' : 'text-base'} font-semibold text-[var(--color-text-primary)]`}>
            {t('settings.terminal.title')}
          </h2>
          {!docked && (
            <p className="mt-0.5 max-w-2xl text-sm text-[var(--color-text-tertiary)]">
              {t('settings.terminal.description')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onOpenInTab && (
            <button
              type="button"
              onClick={onOpenInTab}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              {t('terminal.openInTab')}
            </button>
          )}
          {onNewTerminal && (
            <button
              type="button"
              onClick={onNewTerminal}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t('terminal.newTab')}
            </button>
          )}
          <button
            type="button"
            onClick={clearTerminal}
            disabled={!runtime.terminal}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">mop</span>
            {t('settings.terminal.clear')}
          </button>
          <button
            type="button"
            onClick={() => void startTerminal()}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-text-primary)] px-2.5 text-xs font-medium text-[var(--color-surface)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            {t('settings.terminal.restart')}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('terminal.closePanel')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
            >
              <span className="material-symbols-outlined text-[17px]">close</span>
            </button>
          )}
        </div>
      </div>

      <div className={`${docked ? 'mb-2' : 'mb-3'} flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)]`}>
        <StatusPill status={status} label={t(STATUS_LABEL_KEYS[status])} />
        {shellInfo && (
          <>
            <span className="font-mono">{shellInfo.shell}</span>
            <span className="text-[var(--color-border)]">/</span>
            <span className="min-w-0 max-w-full truncate font-mono">{shellInfo.cwd}</span>
          </>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {showPreferences && isWindows && (
        <>
          <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-4">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t('settings.terminal.preferencesTitle')}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {t('settings.terminal.preferencesBody')}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('settings.terminal.startupShell')}
                </span>
                <Dropdown<DesktopTerminalStartupShell>
                  items={shellItems}
                  value={startupShell}
                  onChange={(value) => {
                    setStartupShell(value)
                    setPreferencesError(null)
                    setPreferencesSaved(false)
                  }}
                  width="100%"
                  trigger={
                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)]"
                    >
                      <span>{shellItems.find((item) => item.value === startupShell)?.label ?? startupShell}</span>
                      <span className="material-symbols-outlined text-[18px] text-[var(--color-text-tertiary)]">expand_more</span>
                    </button>
                  }
                />
              </div>

              {startupShell === 'custom' && (
                <Input
                  label={t('settings.terminal.customPath')}
                  placeholder={t('settings.terminal.customPathPlaceholder')}
                  value={customShellPath}
                  onChange={(event) => {
                    setCustomShellPath(event.target.value)
                    setPreferencesError(null)
                    setPreferencesSaved(false)
                  }}
                  error={preferencesError ?? undefined}
                />
              )}

              {preferencesError && startupShell !== 'custom' && (
                <p className="text-xs text-[var(--color-error)]">{preferencesError}</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  loading={preferencesSaving}
                  onClick={() => void savePreferences()}
                >
                  {t('settings.terminal.saveShell')}
                </Button>
                {preferencesSaved && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('settings.terminal.saveShellSuccess')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <BashPathSettings isTauri={terminalApi.isAvailable()} />
        </>
      )}

      {status === 'unavailable' ? (
        <div className="flex flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-8 text-center">
          <div>
            <span className="material-symbols-outlined mb-3 block text-[32px] text-[var(--color-text-tertiary)]">
              desktop_windows
            </span>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('settings.terminal.unavailableTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              {t('settings.terminal.unavailableBody')}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-terminal-border)] bg-[var(--color-terminal-bg)] shadow-[var(--shadow-dropdown)]">
          <div className="flex h-8 items-center gap-2 border-b border-[var(--color-terminal-border)] bg-[var(--color-terminal-header)] px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-terminal-danger)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-terminal-warning)]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-terminal-accent)]" />
            <span className="ml-2 truncate font-mono text-[11px] text-[var(--color-terminal-muted)]">
              {t('settings.terminal.windowTitle')}
            </span>
          </div>
          <div
            ref={hostRef}
            data-testid={testId}
            className="settings-terminal-host h-[calc(100%-2rem)] w-full overflow-hidden p-2"
          />
        </div>
      )}
    </div>
  )
}

function StatusPill({ status, label }: { status: TerminalStatus; label: string }) {
  const color =
    status === 'running'
      ? 'bg-[var(--color-success)]'
      : status === 'error'
        ? 'bg-[var(--color-error)]'
        : status === 'starting'
          ? 'bg-[var(--color-warning)]'
          : 'bg-[var(--color-text-tertiary)]'

  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-2.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function BashPathSettings({ isTauri }: { isTauri: boolean }) {
  const t = useTranslation()
  const [bashPath, setBashPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    void terminalApi.getBashPath().then((path) => setBashPath(path)).catch(() => {})
  }, [isTauri])

  const handleSave = async () => {
    const trimmed = bashPath?.trim() || null
    setSaving(true)
    setInvalid(false)
    setSaved(false)
    try {
      await terminalApi.setBashPath(trimmed)
      setBashPath(trimmed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setInvalid(true)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setSaved(false)
    setInvalid(false)
    try {
      await terminalApi.setBashPath(null)
      setBashPath(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleBrowse = async () => {
    if (!isTauri) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        title: t('settings.terminal.bashPathLabel'),
        multiple: false,
        filters: [{
          name: 'Bash Executable',
          extensions: ['exe', '', 'bat', 'cmd', 'ps1'],
        }],
      })
      if (selected && typeof selected === 'string') {
        setBashPath(selected)
        setInvalid(false)
      }
    } catch {
      // user cancelled
    }
  }

  if (!isTauri) return null

  return (
    <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3">
      <label className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
        {t('settings.terminal.bashPathLabel')}
      </label>
      <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
        {t('settings.terminal.bashPathDescription')}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={bashPath || ''}
          onChange={(e) => { setBashPath(e.target.value); setInvalid(false); setSaved(false) }}
          placeholder={t('settings.terminal.bashPathLabel')}
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-mono text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
        />
        <button
          type="button"
          onClick={handleBrowse}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-text-primary)] px-3 text-xs font-medium text-[var(--color-surface)] transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {saved ? t('settings.terminal.bashPathSaved') : t('settings.terminal.bashPathSave')}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving || bashPath === null}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        >
          {t('settings.terminal.bashPathReset')}
        </button>
      </div>
      {invalid && (
        <p className="mt-1.5 text-xs text-[var(--color-error)]">
          {t('settings.terminal.bashPathInvalid')}
        </p>
      )}
    </div>
  )
}
