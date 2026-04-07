import { api } from './client'
import type {
  Provider,
  CreateProviderInput,
  UpdateProviderInput,
  TestProviderConfigInput,
  ProviderTestResult,
} from '../types/provider'

type ProvidersResponse = { providers: Provider[] }
type ProviderResponse = { provider: Provider }
type TestResultResponse = { result: ProviderTestResult }

export const providersApi = {
  list() {
    return api.get<ProvidersResponse>('/api/providers')
  },

  get(id: string) {
    return api.get<ProviderResponse>(`/api/providers/${id}`)
  },

  create(input: CreateProviderInput) {
    return api.post<ProviderResponse>('/api/providers', input)
  },

  update(id: string, input: UpdateProviderInput) {
    return api.put<ProviderResponse>(`/api/providers/${id}`, input)
  },

  delete(id: string) {
    return api.delete<{ ok: true }>(`/api/providers/${id}`)
  },

  activate(id: string, modelId: string) {
    return api.post<{ ok: true }>(`/api/providers/${id}/activate`, { modelId })
  },

  test(id: string) {
    return api.post<TestResultResponse>(`/api/providers/${id}/test`)
  },

  testConfig(input: TestProviderConfigInput) {
    return api.post<TestResultResponse>('/api/providers/test', input)
  },
}
