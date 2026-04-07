import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useProviderStore } from '../stores/providerStore'
import { useUIStore } from '../stores/uiStore'
import { Modal } from '../components/shared/Modal'
import { Input } from '../components/shared/Input'
import { Button } from '../components/shared/Button'
import type { PermissionMode, EffortLevel, ModelInfo } from '../types/settings'
import type { Provider, ProviderModel, UpdateProviderInput, ProviderTestResult } from '../types/provider'

type SettingsTab = 'providers' | 'model' | 'permissions' | 'general'

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')
  const setActiveView = useUIStore((s) => s.setActiveView)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--color-border)]">
        <button
          onClick={() => setActiveView('code')}
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-secondary)]"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Settings</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tab navigation */}
        <div className="w-48 border-r border-[var(--color-border)] py-3 flex-shrink-0">
          <TabButton icon="dns" label="Providers" active={activeTab === 'providers'} onClick={() => setActiveTab('providers')} />
          <TabButton icon="auto_awesome" label="Model" active={activeTab === 'model'} onClick={() => setActiveTab('model')} />
          <TabButton icon="shield" label="Permissions" active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} />
          <TabButton icon="tune" label="General" active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'providers' && <ProviderSettings />}
          {activeTab === 'model' && <ModelSettings />}
          {activeTab === 'permissions' && <PermissionSettings />}
          {activeTab === 'general' && <GeneralSettings />}
        </div>
      </div>
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
        active
          ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)] font-medium'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  )
}

// ─── Provider Settings ──────────────────────────────────────

function ProviderSettings() {
  const { providers, isLoading, fetchProviders, deleteProvider, activateProvider, testProvider } = useProviderStore()
  const fetchSettings = useSettingsStore((s) => s.fetchAll)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activatingProvider, setActivatingProvider] = useState<Provider | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean; result?: ProviderTestResult }>>({})

  useEffect(() => { fetchProviders() }, [fetchProviders])

  const handleDelete = async (provider: Provider) => {
    if (provider.isActive) return
    if (!window.confirm(`Delete provider "${provider.name}"? This cannot be undone.`)) return
    try {
      await deleteProvider(provider.id)
    } catch (err) {
      console.error('Failed to delete provider:', err)
    }
  }

  const handleTest = async (provider: Provider) => {
    setTestResults((r) => ({ ...r, [provider.id]: { loading: true } }))
    try {
      const result = await testProvider(provider.id)
      setTestResults((r) => ({ ...r, [provider.id]: { loading: false, result } }))
    } catch {
      setTestResults((r) => ({ ...r, [provider.id]: { loading: false, result: { success: false, latencyMs: 0, error: 'Request failed' } } }))
    }
  }

  const handleActivate = async (providerId: string, modelId: string) => {
    await activateProvider(providerId, modelId)
    await fetchSettings()
    setActivatingProvider(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Providers</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">Manage API providers for model access.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Provider
        </Button>
      </div>

      {isLoading && providers.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-xl">
          <span className="material-symbols-outlined text-[36px] text-[var(--color-text-tertiary)] mb-2 block">dns</span>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">No providers configured</p>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>Add your first provider</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {providers.map((provider) => {
            const test = testResults[provider.id]
            return (
              <div
                key={provider.id}
                className={`relative flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all group ${
                  provider.isActive
                    ? 'border-[var(--color-brand)] bg-[var(--color-primary-fixed)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)]'
                }`}
              >
                {/* Status dot */}
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${provider.isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{provider.name}</span>
                    {provider.isActive && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--color-brand)] text-white leading-none">ACTIVE</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                    {provider.baseUrl} &middot; {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                  </div>
                  {/* Test result inline */}
                  {test && !test.loading && test.result && (
                    <div className={`text-xs mt-1 ${test.result.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                      {test.result.success ? `Connected (${test.result.latencyMs}ms)` : `Failed: ${test.result.error}`}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {!provider.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => setActivatingProvider(provider)}>Activate</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleTest(provider)} loading={test?.loading}>
                    Test
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingProvider(provider)}>Edit</Button>
                  {!provider.isActive && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(provider)} className="text-[var(--color-error)] hover:text-[var(--color-error)]">
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <ProviderFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
      />

      {/* Edit Modal */}
      {editingProvider && (
        <ProviderFormModal
          key={editingProvider.id}
          open={true}
          onClose={() => setEditingProvider(null)}
          mode="edit"
          provider={editingProvider}
        />
      )}

      {/* Activate — model picker */}
      {activatingProvider && (
        <Modal open={true} onClose={() => setActivatingProvider(null)} title={`Activate ${activatingProvider.name}`} width={420}>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">Select a model to use with this provider:</p>
          <div className="flex flex-col gap-2">
            {activatingProvider.models.map((m) => (
              <button
                key={m.id}
                onClick={() => handleActivate(activatingProvider.id, m.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] text-left transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-[var(--color-text-secondary)]">smart_toy</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{m.name}</div>
                  {m.description && <div className="text-xs text-[var(--color-text-tertiary)]">{m.description}{m.context ? ` · ${m.context}` : ''}</div>}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Provider Form Modal ──────────────────────────────────────

type ProviderFormProps = {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  provider?: Provider
}

function ProviderFormModal({ open, onClose, mode, provider }: ProviderFormProps) {
  const { createProvider, updateProvider, testConfig } = useProviderStore()
  const fetchSettings = useSettingsStore((s) => s.fetchAll)

  const [name, setName] = useState(provider?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState('')
  const [notes, setNotes] = useState(provider?.notes ?? '')
  const [models, setModels] = useState<ProviderModel[]>(provider?.models ?? [{ id: '', name: '', description: '', context: '' }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const canSubmit = name.trim() && baseUrl.trim() && (mode === 'edit' || apiKey.trim()) && models.some((m) => m.id.trim() && m.name.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    try {
      const validModels = models.filter((m) => m.id.trim() && m.name.trim())
      if (mode === 'create') {
        await createProvider({
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          models: validModels,
          notes: notes.trim() || undefined,
        })
      } else if (provider) {
        const input: UpdateProviderInput = {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          models: validModels,
          notes: notes.trim() || undefined,
        }
        if (apiKey.trim()) input.apiKey = apiKey.trim()
        await updateProvider(provider.id, input)
        if (provider.isActive) await fetchSettings()
      }
      onClose()
    } catch (err) {
      console.error('Failed to save provider:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async () => {
    const firstModel = models.find((m) => m.id.trim())
    if (!baseUrl.trim() || !apiKey.trim() || !firstModel) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), modelId: firstModel.id.trim() })
      setTestResult(result)
    } catch {
      setTestResult({ success: false, latencyMs: 0, error: 'Request failed' })
    } finally {
      setIsTesting(false)
    }
  }

  const addModel = () => setModels([...models, { id: '', name: '', description: '', context: '' }])
  const removeModel = (index: number) => setModels(models.filter((_, i) => i !== index))
  const updateModel = (index: number, field: keyof ProviderModel, value: string) => {
    setModels(models.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Add Provider' : 'Edit Provider'}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
            {mode === 'create' ? 'Add' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OpenRouter, Anthropic Official" />
        <Input label="Base URL" required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.anthropic.com" />
        <Input
          label={mode === 'edit' ? 'API Key (leave blank to keep current)' : 'API Key'}
          required={mode === 'create'}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={mode === 'edit' ? '****' : 'sk-ant-...'}
        />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />

        {/* Models */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Models <span className="text-[var(--color-error)]">*</span>
            </label>
            <button onClick={addModel} className="text-xs text-[var(--color-brand)] hover:underline">+ Add model</button>
          </div>
          {models.map((m, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  value={m.id}
                  onChange={(e) => updateModel(i, 'id', e.target.value)}
                  placeholder="Model ID *"
                  className="h-8 px-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-focus)]"
                />
                <input
                  value={m.name}
                  onChange={(e) => updateModel(i, 'name', e.target.value)}
                  placeholder="Display name *"
                  className="h-8 px-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-focus)]"
                />
                <input
                  value={m.description ?? ''}
                  onChange={(e) => updateModel(i, 'description', e.target.value)}
                  placeholder="Description"
                  className="h-8 px-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-focus)]"
                />
                <input
                  value={m.context ?? ''}
                  onChange={(e) => updateModel(i, 'context', e.target.value)}
                  placeholder="Context (e.g. 200k)"
                  className="h-8 px-2 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:border-[var(--color-border-focus)]"
                />
              </div>
              {models.length > 1 && (
                <button onClick={() => removeModel(i)} className="mt-1 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleTest} loading={isTesting} disabled={!baseUrl.trim() || !apiKey.trim() || !models.some((m) => m.id.trim())}>
            Test Connection
          </Button>
          {testResult && (
            <span className={`text-xs ${testResult.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              {testResult.success ? `Connected (${testResult.latencyMs}ms)` : `Failed: ${testResult.error}`}
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Model Settings ──────────────────────────────────────

function ModelSettings() {
  const { availableModels, currentModel, effortLevel, activeProviderName, setModel, setEffort, fetchAll } = useSettingsStore()
  const [customModelId, setCustomModelId] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSelectModel = async (model: ModelInfo) => {
    await setModel(model.id)
  }

  const handleCustomModel = async () => {
    const id = customModelId.trim()
    if (!id) return
    await setModel(id)
    setShowCustom(false)
    setCustomModelId('')
  }

  const MODEL_ICONS: Record<string, string> = {
    'opus': 'diamond',
    'sonnet': 'auto_awesome',
    'haiku': 'bolt',
  } as const

  const getModelIcon = (id: string) => {
    if (id.includes('opus')) return MODEL_ICONS['opus']
    if (id.includes('sonnet')) return MODEL_ICONS['sonnet']
    if (id.includes('haiku')) return MODEL_ICONS['haiku']
    return 'smart_toy'
  }

  const EFFORT_LABELS: Record<EffortLevel, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    max: 'Max',
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Model</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
        Choose the AI model for new conversations.
        {activeProviderName && (
          <span className="ml-1 text-[var(--color-text-secondary)]">
            (via <span className="font-medium">{activeProviderName}</span>)
          </span>
        )}
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {availableModels.map((model) => {
          const isSelected = currentModel?.id === model.id
          return (
            <button
              key={model.id}
              onClick={() => handleSelectModel(model)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'border-[var(--color-brand)] bg-[var(--color-primary-fixed)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-[var(--color-text-secondary)]">
                {getModelIcon(model.id)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{model.name}</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">{model.description} · {model.context} context</div>
              </div>
              {isSelected && (
                <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              )}
            </button>
          )
        })}

        {/* Custom model */}
        {showCustom ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--color-border)]">
            <input
              type="text"
              value={customModelId}
              onChange={(e) => setCustomModelId(e.target.value)}
              placeholder="Enter model ID (e.g. claude-sonnet-4-6-20250514)"
              className="flex-1 text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              onKeyDown={(e) => e.key === 'Enter' && handleCustomModel()}
            />
            <button onClick={handleCustomModel} className="px-3 py-1 text-xs font-semibold text-white bg-[var(--color-brand)] rounded-lg hover:opacity-90">
              Apply
            </button>
            <button onClick={() => setShowCustom(false)} className="px-2 py-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[var(--color-border)] hover:border-[var(--color-border-focus)] text-left transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-[var(--color-text-tertiary)]">add</span>
            <span className="text-sm text-[var(--color-text-secondary)]">Use custom model ID</span>
          </button>
        )}
      </div>

      {/* Effort level */}
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Effort Level</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-3">Controls how much computation the model uses.</p>
      <div className="flex gap-2">
        {(['low', 'medium', 'high', 'max'] as EffortLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => setEffort(level)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
              effortLevel === level
                ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {EFFORT_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Permission Settings ──────────────────────────────────────

function PermissionSettings() {
  const { permissionMode, setPermissionMode } = useSettingsStore()

  const MODES: Array<{ mode: PermissionMode; icon: string; label: string; desc: string }> = [
    { mode: 'default', icon: 'verified_user', label: 'Ask permissions', desc: 'Ask before executing tools' },
    { mode: 'acceptEdits', icon: 'edit_note', label: 'Accept edits', desc: 'Auto-approve file edits, ask for others' },
    { mode: 'plan', icon: 'architecture', label: 'Plan mode', desc: 'Think and plan without executing' },
    { mode: 'bypassPermissions', icon: 'bolt', label: 'Bypass all', desc: 'Skip all permission checks (dangerous)' },
  ]

  return (
    <div className="max-w-xl">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Permission Mode</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">Controls how tool execution permissions are handled.</p>

      <div className="flex flex-col gap-2">
        {MODES.map(({ mode, icon, label, desc }) => {
          const isSelected = permissionMode === mode
          return (
            <button
              key={mode}
              onClick={() => setPermissionMode(mode)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'border-[var(--color-brand)] bg-[var(--color-primary-fixed)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-[var(--color-text-secondary)]">{icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">{desc}</div>
              </div>
              {isSelected && (
                <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── General Settings ──────────────────────────────────────

function GeneralSettings() {
  return (
    <div className="max-w-xl">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">General</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
        API configuration is now managed through the <strong>Providers</strong> tab.
      </p>
    </div>
  )
}
