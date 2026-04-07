import { create } from 'zustand'
import { providersApi } from '../api/providers'
import type {
  Provider,
  CreateProviderInput,
  UpdateProviderInput,
  TestProviderConfigInput,
  ProviderTestResult,
} from '../types/provider'

type ProviderStore = {
  providers: Provider[]
  isLoading: boolean

  fetchProviders: () => Promise<void>
  createProvider: (input: CreateProviderInput) => Promise<Provider>
  updateProvider: (id: string, input: UpdateProviderInput) => Promise<Provider>
  deleteProvider: (id: string) => Promise<void>
  activateProvider: (id: string, modelId: string) => Promise<void>
  testProvider: (id: string) => Promise<ProviderTestResult>
  testConfig: (input: TestProviderConfigInput) => Promise<ProviderTestResult>
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  isLoading: false,

  fetchProviders: async () => {
    set({ isLoading: true })
    try {
      const { providers } = await providersApi.list()
      set({ providers, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createProvider: async (input) => {
    const { provider } = await providersApi.create(input)
    await get().fetchProviders()
    return provider
  },

  updateProvider: async (id, input) => {
    const { provider } = await providersApi.update(id, input)
    await get().fetchProviders()
    return provider
  },

  deleteProvider: async (id) => {
    await providersApi.delete(id)
    await get().fetchProviders()
  },

  activateProvider: async (id, modelId) => {
    await providersApi.activate(id, modelId)
    await get().fetchProviders()
  },

  testProvider: async (id) => {
    const { result } = await providersApi.test(id)
    return result
  },

  testConfig: async (input) => {
    const { result } = await providersApi.testConfig(input)
    return result
  },
}))
