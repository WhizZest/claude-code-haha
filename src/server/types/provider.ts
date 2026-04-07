/**
 * Provider 类型定义
 *
 * Provider 是自定义 API 供应商的配置单元，包含 Base URL、API Key 和可用模型列表。
 * 激活 Provider 时，其配置会写入 ~/.claude/settings.json 的 env 字段。
 */

import { z } from 'zod'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const ProviderModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  context: z.string().optional(),
})

export const ProviderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  models: z.array(ProviderModelSchema).min(1),
  isActive: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  notes: z.string().optional(),
})

export const CreateProviderSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  models: z.array(ProviderModelSchema).min(1),
  notes: z.string().optional(),
})

export const UpdateProviderSchema = z.object({
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  models: z.array(ProviderModelSchema).min(1).optional(),
  notes: z.string().optional(),
})

export const TestProviderSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
})

export const ActivateProviderSchema = z.object({
  modelId: z.string().min(1),
})

export const ProvidersConfigSchema = z.object({
  providers: z.array(ProviderSchema),
  activeModel: z.string().optional(),
  version: z.number(),
})

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type ProviderModel = z.infer<typeof ProviderModelSchema>
export type Provider = z.infer<typeof ProviderSchema>
export type CreateProviderInput = z.infer<typeof CreateProviderSchema>
export type UpdateProviderInput = z.infer<typeof UpdateProviderSchema>
export type TestProviderInput = z.infer<typeof TestProviderSchema>
export type ActivateProviderInput = z.infer<typeof ActivateProviderSchema>
export type ProvidersConfig = z.infer<typeof ProvidersConfigSchema>

export interface ProviderTestResult {
  success: boolean
  latencyMs: number
  error?: string
  modelUsed?: string
  httpStatus?: number
}
