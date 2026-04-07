import { useState, useEffect, useRef } from 'react'
import { sessionsApi, type RecentProject } from '../../api/sessions'
import { filesystemApi } from '../../api/filesystem'

type Props = {
  value: string
  onChange: (path: string) => void
}

type DirEntry = { name: string; path: string; isDirectory: boolean }

export function DirectoryPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'recent' | 'browse'>('recent')
  const [projects, setProjects] = useState<RecentProject[]>([])
  const [browseEntries, setBrowseEntries] = useState<DirEntry[]>([])
  const [browsePath, setBrowsePath] = useState('')
  const [browseParent, setBrowseParent] = useState('')
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Load recent projects when opened
  useEffect(() => {
    if (!open || mode !== 'recent') return
    setLoading(true)
    sessionsApi.getRecentProjects()
      .then(({ projects }) => setProjects(projects))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [open, mode])

  const loadBrowseDir = async (path?: string) => {
    setLoading(true)
    try {
      const result = await filesystemApi.browse(path)
      setBrowsePath(result.currentPath)
      setBrowseParent(result.parentPath)
      setBrowseEntries(result.entries)
    } catch { /* API not available */ }
    setLoading(false)
  }

  const handleSelect = (path: string) => {
    onChange(path)
    setOpen(false)
    setMode('recent')
  }

  const switchToBrowse = () => {
    setMode('browse')
    loadBrowseDir(value || undefined)
  }

  // Find selected project info
  const selectedProject = projects.find((p) => p.realPath === value)

  return (
    <div ref={ref} className="relative">
      {/* Trigger — shows selected project chip or placeholder */}
      {value ? (
        <button
          onClick={() => { setOpen(!open); setMode('recent') }}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-hover)] rounded-full text-xs transition-colors border border-[var(--color-border)]"
        >
          {/* GitHub icon for git repos, folder for others */}
          {selectedProject?.isGit ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--color-text-secondary)]">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          ) : (
            <span className="material-symbols-outlined text-[14px] text-[var(--color-text-secondary)]">folder</span>
          )}
          <span className="font-medium text-[var(--color-text-primary)]">
            {selectedProject?.repoName || selectedProject?.projectName || value.split('/').pop()}
          </span>
          {selectedProject?.branch && (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
                <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
                <path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
              </svg>
              <span className="text-[var(--color-text-tertiary)]">{selectedProject.branch}</span>
            </>
          )}
          <span className="material-symbols-outlined text-[12px] text-[var(--color-text-tertiary)]">expand_more</span>
        </button>
      ) : (
        <button
          onClick={() => { setOpen(!open); setMode('recent') }}
          className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">folder_open</span>
          Select a project...
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-[400px] z-50 bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-dropdown)] overflow-hidden">
          {mode === 'recent' ? (
            /* Recent projects mode */
            <>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-outline)]">
                Recent
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">Loading...</div>
                ) : projects.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">No recent projects</div>
                ) : (
                  projects.map((project) => {
                    const isSelected = project.realPath === value
                    return (
                      <button
                        key={project.projectPath}
                        onClick={() => handleSelect(project.realPath)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-hover)] ${
                          isSelected ? 'bg-[var(--color-surface-selected)]' : ''
                        }`}
                      >
                        {/* Icon */}
                        {project.isGit ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                            <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" />
                            <path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
                          </svg>
                        ) : (
                          <span className="material-symbols-outlined text-[20px] text-[var(--color-text-secondary)] flex-shrink-0">folder</span>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                            {project.repoName || project.projectName}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-tertiary)] truncate font-[var(--font-mono)]">
                            {project.realPath}
                          </div>
                        </div>

                        {/* Check mark */}
                        {isSelected && (
                          <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>

              {/* Divider + Choose different folder */}
              <div className="border-t border-[var(--color-border)]">
                <button
                  onClick={switchToBrowse}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-[var(--color-text-tertiary)]">create_new_folder</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">Choose a different folder</span>
                </button>
              </div>
            </>
          ) : (
            /* File browser mode */
            <>
              <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center gap-1 flex-wrap">
                <button onClick={() => setMode('recent')} className="text-xs text-[var(--color-text-accent)] hover:underline mr-2">
                  ← Recent
                </button>
                <button onClick={() => loadBrowseDir('/')} className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">/</button>
                {browsePath.split('/').filter(Boolean).map((seg, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">/</span>
                    <button
                      onClick={() => loadBrowseDir('/' + arr.slice(0, i + 1).join('/'))}
                      className="text-[10px] text-[var(--color-text-accent)] hover:underline"
                    >{seg}</button>
                  </span>
                ))}
              </div>

              <div className="max-h-[240px] overflow-y-auto">
                {loading ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">Loading...</div>
                ) : (
                  <>
                    {browseParent && browseParent !== browsePath && (
                      <button onClick={() => loadBrowseDir(browseParent)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-hover)]">
                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-tertiary)]">arrow_upward</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">..</span>
                      </button>
                    )}
                    {browseEntries.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">No subdirectories</div>
                    ) : browseEntries.map((entry) => (
                      <button
                        key={entry.path}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-hover)]"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-tertiary)]" onClick={() => loadBrowseDir(entry.path)}>folder</span>
                        <span className="text-xs text-[var(--color-text-primary)] flex-1" onClick={() => loadBrowseDir(entry.path)}>{entry.name}</span>
                        <button onClick={() => handleSelect(entry.path)} className="px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-primary-fixed)] rounded transition-colors">
                          Select
                        </button>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Use current folder */}
              <div className="px-3 py-2 border-t border-[var(--color-border)] flex justify-between items-center">
                <span className="text-[10px] text-[var(--color-text-tertiary)] font-[var(--font-mono)] truncate">{browsePath}</span>
                <button onClick={() => handleSelect(browsePath)} className="px-3 py-1.5 bg-[var(--color-brand)] text-white text-xs font-semibold rounded-lg hover:opacity-90">
                  Use this folder
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
