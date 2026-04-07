// Source: src/server/types/provider.ts

export type ProviderModel = {
  id: string
  name: string
  description?: string
  context?: string
}

export type Provider = {
  id: string
  name: string
  baseUrl: string
  apiKey: string // masked from server: "sk-a****xyz"
  models: ProviderModel[]
  isActive: boolean
  createdAt: number
  updatedAt: number
  notes?: string
}

export type CreateProviderInput = {
  name: string
  baseUrl: string
  apiKey: string
  models: ProviderModel[]
  notes?: string
}

export type UpdateProviderInput = {
  name?: string
  baseUrl?: string
  apiKey?: string
  models?: ProviderModel[]
  notes?: string
}

export type TestProviderConfigInput = {
  baseUrl: string
  apiKey: string
  modelId: string
}

export type ProviderTestResult = {
  success: boolean
  latencyMs: number
  error?: string
  modelUsed?: string
  httpStatus?: number
}
