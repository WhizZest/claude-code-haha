/**
 * Providers REST API
 *
 * GET    /api/providers            — 列出所有 provider
 * GET    /api/providers/:id        — 获取单个 provider
 * POST   /api/providers            — 添加 provider
 * PUT    /api/providers/:id        — 更新 provider
 * DELETE /api/providers/:id        — 删除 provider
 * POST   /api/providers/:id/activate — 激活 provider
 * POST   /api/providers/:id/test   — 测试已保存 provider
 * POST   /api/providers/test       — 测试未保存的配置
 */

import { z } from 'zod'
import { ProviderService } from '../services/providerService.js'
import {
  CreateProviderSchema,
  UpdateProviderSchema,
  TestProviderSchema,
  ActivateProviderSchema,
} from '../types/provider.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

const providerService = new ProviderService()

// ─── Sanitization ─────────────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

function sanitizeProvider(provider: Record<string, unknown>): Record<string, unknown> {
  if (typeof provider.apiKey === 'string') {
    return { ...provider, apiKey: maskApiKey(provider.apiKey) }
  }
  return provider
}

// ─── Router ───────────────────────────────────────────────────────────────────

export async function handleProvidersApi(
  req: Request,
  url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const id = segments[2] // provider ID or 'test'
    const action = segments[3] // 'activate' | 'test' | undefined

    // ── POST /api/providers/test (test unsaved configuration) ──────────
    if (id === 'test' && req.method === 'POST') {
      return await handleTestUnsaved(req)
    }

    // ── /api/providers (no ID) ────────────────────────────────────────
    if (!id) {
      if (req.method === 'GET') {
        const providers = await providerService.listProviders()
        return Response.json({ providers: providers.map(sanitizeProvider) })
      }
      if (req.method === 'POST') {
        return await handleCreate(req)
      }
      throw methodNotAllowed(req.method)
    }

    // ── /api/providers/:id/activate ───────────────────────────────────
    if (action === 'activate') {
      if (req.method !== 'POST') throw methodNotAllowed(req.method)
      return await handleActivate(req, id)
    }

    // ── /api/providers/:id/test ───────────────────────────────────────
    if (action === 'test') {
      if (req.method !== 'POST') throw methodNotAllowed(req.method)
      const result = await providerService.testProvider(id)
      return Response.json({ result })
    }

    // ── /api/providers/:id (no action) ────────────────────────────────
    if (req.method === 'GET') {
      const provider = await providerService.getProvider(id)
      return Response.json({ provider: sanitizeProvider(provider) })
    }
    if (req.method === 'PUT') {
      return await handleUpdate(req, id)
    }
    if (req.method === 'DELETE') {
      await providerService.deleteProvider(id)
      return Response.json({ ok: true })
    }

    throw methodNotAllowed(req.method)
  } catch (error) {
    return errorResponse(error)
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCreate(req: Request): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = CreateProviderSchema.parse(body)
    const provider = await providerService.addProvider(input)
    return Response.json({ provider }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    }
    throw err
  }
}

async function handleUpdate(req: Request, id: string): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = UpdateProviderSchema.parse(body)
    const provider = await providerService.updateProvider(id, input)
    return Response.json({ provider })
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    }
    throw err
  }
}

async function handleActivate(req: Request, id: string): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = ActivateProviderSchema.parse(body)
    await providerService.activateProvider(id, input.modelId)
    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    }
    throw err
  }
}

async function handleTestUnsaved(req: Request): Promise<Response> {
  const body = await parseJsonBody(req)
  try {
    const input = TestProviderSchema.parse(body)
    const result = await providerService.testProviderConfig(input)
    return Response.json({ result })
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.badRequest(err.issues.map((i) => i.message).join('; '))
    }
    throw err
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }
}

function methodNotAllowed(method: string): ApiError {
  return new ApiError(405, `Method ${method} not allowed`, 'METHOD_NOT_ALLOWED')
}
