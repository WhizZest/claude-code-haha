/**
 * Provider Service — AI provider configuration management
 *
 * Manages custom API providers (base URL, API key, models).
 * When a provider is activated, its configuration is synced to
 * ~/.claude/settings.json so that Claude Code uses it.
 *
 * Storage: ~/.claude/providers.json (atomic write via .tmp + rename)
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { ApiError } from '../middleware/errorHandler.js'
import type {
  Provider,
  CreateProviderInput,
  UpdateProviderInput,
  ProvidersConfig,
  TestProviderInput,
  ProviderTestResult,
} from '../types/provider.js'

const DEFAULT_CONFIG: ProvidersConfig = {
  providers: [],
  version: 1,
}

export class ProviderService {
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Config directory, overridable via CLAUDE_CONFIG_DIR (for testing) */
  private getConfigDir(): string {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  }

  /** Path to the providers configuration file */
  private getProvidersPath(): string {
    return path.join(this.getConfigDir(), 'providers.json')
  }

  /** Read providers config; returns empty defaults when the file does not exist */
  private async readProvidersConfig(): Promise<ProvidersConfig> {
    try {
      const raw = await fs.readFile(this.getProvidersPath(), 'utf-8')
      return JSON.parse(raw) as ProvidersConfig
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ...DEFAULT_CONFIG, providers: [] }
      }
      throw ApiError.internal(
        `Failed to read providers config: ${err}`,
      )
    }
  }

  /** Atomic write: write to .tmp first, then rename */
  private async writeProvidersConfig(config: ProvidersConfig): Promise<void> {
    const filePath = this.getProvidersPath()
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    const tmpFile = `${filePath}.tmp.${Date.now()}`
    try {
      await fs.writeFile(tmpFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
      await fs.rename(tmpFile, filePath)
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {})
      throw ApiError.internal(`Failed to write providers config: ${err}`)
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /** List all providers */
  async listProviders(): Promise<Provider[]> {
    const config = await this.readProvidersConfig()
    return config.providers
  }

  /** Get a single provider by id; throws 404 if not found */
  async getProvider(id: string): Promise<Provider> {
    const config = await this.readProvidersConfig()
    const provider = config.providers.find((p) => p.id === id)
    if (!provider) {
      throw ApiError.notFound(`Provider not found: ${id}`)
    }
    return provider
  }

  /** Get the currently active provider, or null if none */
  async getActiveProvider(): Promise<Provider | null> {
    const config = await this.readProvidersConfig()
    return config.providers.find((p) => p.isActive) ?? null
  }

  /** Add a new provider. If it is the first one, activate it automatically. */
  async addProvider(input: CreateProviderInput): Promise<Provider> {
    const config = await this.readProvidersConfig()
    const now = Date.now()
    const isFirst = config.providers.length === 0

    const provider: Provider = {
      id: crypto.randomUUID(),
      name: input.name,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      models: input.models,
      isActive: isFirst,
      createdAt: now,
      updatedAt: now,
      ...(input.notes !== undefined && { notes: input.notes }),
    }

    config.providers.push(provider)

    // Auto-activate the first provider with its first model
    if (isFirst && provider.models.length > 0) {
      config.activeModel = provider.models[0].id
    }

    await this.writeProvidersConfig(config)

    // Sync to settings if this provider was auto-activated
    if (isFirst && provider.models.length > 0) {
      await this.syncToSettings(provider, provider.models[0].id)
    }

    return provider
  }

  /** Update an existing provider */
  async updateProvider(id: string, input: UpdateProviderInput): Promise<Provider> {
    const config = await this.readProvidersConfig()
    const index = config.providers.findIndex((p) => p.id === id)
    if (index === -1) {
      throw ApiError.notFound(`Provider not found: ${id}`)
    }

    const existing = config.providers[index]
    const updated: Provider = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl }),
      ...(input.apiKey !== undefined && { apiKey: input.apiKey }),
      ...(input.models !== undefined && { models: input.models }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: Date.now(),
    }

    config.providers[index] = updated

    // If the updated provider is active, validate activeModel still exists
    if (updated.isActive && config.activeModel) {
      const modelStillExists = updated.models.some((m) => m.id === config.activeModel)
      if (!modelStillExists) {
        config.activeModel = updated.models[0]?.id
      }
    }

    await this.writeProvidersConfig(config)

    // Re-sync settings if active
    if (updated.isActive && config.activeModel) {
      await this.syncToSettings(updated, config.activeModel)
    }

    return updated
  }

  /** Delete a provider; refuses to delete an active provider */
  async deleteProvider(id: string): Promise<void> {
    const config = await this.readProvidersConfig()
    const index = config.providers.findIndex((p) => p.id === id)
    if (index === -1) {
      throw ApiError.notFound(`Provider not found: ${id}`)
    }

    if (config.providers[index].isActive) {
      throw ApiError.conflict(
        'Cannot delete an active provider. Deactivate it first by activating another provider.',
      )
    }

    config.providers.splice(index, 1)
    await this.writeProvidersConfig(config)
  }

  // ---------------------------------------------------------------------------
  // Activation
  // ---------------------------------------------------------------------------

  /**
   * Activate a provider with a specific model.
   *
   * 1. Validate provider exists and modelId belongs to it
   * 2. Deactivate all providers
   * 3. Activate the target provider
   * 4. Set config.activeModel
   * 5. Persist providers.json
   * 6. Sync env to settings.json
   */
  async activateProvider(id: string, modelId: string): Promise<void> {
    const config = await this.readProvidersConfig()
    const provider = config.providers.find((p) => p.id === id)
    if (!provider) {
      throw ApiError.notFound(`Provider not found: ${id}`)
    }

    const model = provider.models.find((m) => m.id === modelId)
    if (!model) {
      throw ApiError.badRequest(
        `Model "${modelId}" not found in provider "${provider.name}". Available models: ${provider.models.map((m) => m.id).join(', ')}`,
      )
    }

    // Deactivate all, then activate target
    for (const p of config.providers) {
      p.isActive = false
    }
    provider.isActive = true
    config.activeModel = modelId

    await this.writeProvidersConfig(config)
    await this.syncToSettings(provider, modelId)
  }

  // ---------------------------------------------------------------------------
  // Settings sync
  // ---------------------------------------------------------------------------

  /**
   * Sync the active provider's configuration to settings.json.
   *
   * Preserves all existing fields; only updates `env` (merging into existing
   * env vars) and `model`.
   */
  private async syncToSettings(provider: Provider, modelId: string): Promise<void> {
    const settingsPath = path.join(this.getConfigDir(), 'settings.json')

    // Read existing settings
    let settings: Record<string, unknown> = {}
    try {
      const raw = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(raw) as Record<string, unknown>
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw ApiError.internal(`Failed to read settings.json: ${err}`)
      }
      // File doesn't exist yet — start with empty object
    }

    // Merge env: preserve existing env vars, override only ours
    const existingEnv = (settings.env as Record<string, string>) || {}
    settings.env = {
      ...existingEnv,
      ANTHROPIC_BASE_URL: provider.baseUrl,
      ANTHROPIC_AUTH_TOKEN: provider.apiKey,
    }

    // Set model
    settings.model = modelId

    // Atomic write
    const dir = path.dirname(settingsPath)
    await fs.mkdir(dir, { recursive: true })

    const tmpFile = `${settingsPath}.tmp.${Date.now()}`
    try {
      await fs.writeFile(tmpFile, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
      await fs.rename(tmpFile, settingsPath)
    } catch (err) {
      await fs.unlink(tmpFile).catch(() => {})
      throw ApiError.internal(`Failed to write settings.json: ${err}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Connectivity testing
  // ---------------------------------------------------------------------------

  /** Test connectivity of a saved provider */
  async testProvider(id: string): Promise<ProviderTestResult> {
    const provider = await this.getProvider(id)

    if (provider.models.length === 0) {
      return {
        success: false,
        latencyMs: 0,
        error: 'Provider has no models configured',
      }
    }

    return this.testProviderConfig({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      modelId: provider.models[0].id,
    })
  }

  /** Test connectivity with an arbitrary configuration */
  async testProviderConfig(input: TestProviderInput): Promise<ProviderTestResult> {
    const url = `${input.baseUrl.replace(/\/+$/, '')}/v1/messages`
    const start = Date.now()

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': input.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: input.modelId,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(15000),
      })

      const latencyMs = Date.now() - start

      if (response.ok) {
        return {
          success: true,
          latencyMs,
          modelUsed: input.modelId,
          httpStatus: response.status,
        }
      }

      // Non-OK response — try to extract error message
      let errorMessage = `HTTP ${response.status}`
      try {
        const body = (await response.json()) as Record<string, unknown>
        if (body.error && typeof body.error === 'object') {
          const errObj = body.error as Record<string, unknown>
          errorMessage = (errObj.message as string) || errorMessage
        } else if (typeof body.message === 'string') {
          errorMessage = body.message
        }
      } catch {
        // Could not parse body — use status text
        errorMessage = `HTTP ${response.status} ${response.statusText}`
      }

      return {
        success: false,
        latencyMs,
        error: errorMessage,
        modelUsed: input.modelId,
        httpStatus: response.status,
      }
    } catch (err: unknown) {
      const latencyMs = Date.now() - start

      if (err instanceof DOMException && err.name === 'TimeoutError') {
        return {
          success: false,
          latencyMs,
          error: 'Request timed out after 15 seconds',
          modelUsed: input.modelId,
        }
      }

      return {
        success: false,
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
        modelUsed: input.modelId,
      }
    }
  }
}
