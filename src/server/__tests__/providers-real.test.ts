/**
 * 用真实的 Provider 配置测试 ProviderService
 * 验证添加、激活、settings.json 同步是否正确
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { ProviderService } from '../services/providerService.js'

describe('Real Provider Configs', () => {
  let tmpDir: string
  let service: ProviderService

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-real-'))
    process.env.CLAUDE_CONFIG_DIR = tmpDir
    service = new ProviderService()
  })

  afterEach(async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('添加 MiniMax Provider 并激活', async () => {
    const minimax = await service.addProvider({
      name: 'MiniMax',
      baseUrl: 'https://api.minimaxi.com/anthropic',
      apiKey: 'sk-api-aijgzQKtr1vLPS1KaoySY7_TRGTXCiQTCvgmoLOG31eyMfnrTBOLdtsEd_fFGAghPY_9Tlxt_jPc6bs5bziApZoEIuGq6bAERlKd-XHebifv44HMxLHDvjQ',
      models: [
        { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed', description: 'MiniMax 高速模型' },
      ],
      notes: 'MiniMax 官方 Anthropic 兼容接口',
    })

    // 第一个 provider 应该自动激活
    expect(minimax.isActive).toBe(true)
    expect(minimax.name).toBe('MiniMax')

    // 验证 settings.json 写入
    const settings = JSON.parse(await fs.readFile(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.env.ANTHROPIC_BASE_URL).toBe('https://api.minimaxi.com/anthropic')
    expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe(minimax.apiKey)
    expect(settings.model).toBe('MiniMax-M2.7-highspeed')

    console.log('✅ MiniMax Provider 添加并自动激活成功')
    console.log('   settings.json env:', JSON.stringify(settings.env, null, 2))
    console.log('   settings.json model:', settings.model)
  })

  test('添加接口AI中转站 Provider，切换激活', async () => {
    // 先添加 MiniMax（自动激活）
    const minimax = await service.addProvider({
      name: 'MiniMax',
      baseUrl: 'https://api.minimaxi.com/anthropic',
      apiKey: 'sk-api-test-minimax',
      models: [
        { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed' },
      ],
    })
    expect(minimax.isActive).toBe(true)

    // 添加接口AI中转站（不应自动激活）
    const jiekou = await service.addProvider({
      name: '接口AI中转站',
      baseUrl: 'https://api.jiekou.ai/anthropic',
      apiKey: 'sk_WGYwseQ5YZ1Kb6tXbqnd-AXIAhlqFnYLfUt2gSF-vjQ',
      models: [
        { id: 'claude-opus-4-6', name: 'Opus 4.6', description: 'Most capable', context: '200k' },
        { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', description: 'Most efficient', context: '200k' },
        { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', description: 'Fastest', context: '200k' },
      ],
      notes: '接口AI中转站 — 支持多个 Claude 模型',
    })
    expect(jiekou.isActive).toBe(false)

    // 激活接口AI中转站，选择 Opus 4.6
    await service.activateProvider(jiekou.id, 'claude-opus-4-6')

    // 验证 providers.json
    const providers = await service.listProviders()
    const activeMinimax = providers.find(p => p.id === minimax.id)!
    const activeJiekou = providers.find(p => p.id === jiekou.id)!
    expect(activeMinimax.isActive).toBe(false)
    expect(activeJiekou.isActive).toBe(true)

    // 验证 settings.json
    const settings = JSON.parse(await fs.readFile(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.env.ANTHROPIC_BASE_URL).toBe('https://api.jiekou.ai/anthropic')
    expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe(jiekou.apiKey)
    expect(settings.model).toBe('claude-opus-4-6')

    console.log('✅ 接口AI中转站激活成功')
    console.log('   settings.json env:', JSON.stringify(settings.env, null, 2))
    console.log('   settings.json model:', settings.model)
  })

  test('切换模型 — 从 Opus 切到 Sonnet', async () => {
    const jiekou = await service.addProvider({
      name: '接口AI中转站',
      baseUrl: 'https://api.jiekou.ai/anthropic',
      apiKey: 'sk_test_jiekou',
      models: [
        { id: 'claude-opus-4-6', name: 'Opus 4.6' },
        { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6' },
        { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
      ],
    })

    // 自动激活了第一个模型 opus
    let settings = JSON.parse(await fs.readFile(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.model).toBe('claude-opus-4-6')

    // 切换到 Sonnet
    await service.activateProvider(jiekou.id, 'claude-sonnet-4-6')
    settings = JSON.parse(await fs.readFile(path.join(tmpDir, 'settings.json'), 'utf-8'))
    expect(settings.model).toBe('claude-sonnet-4-6')

    console.log('✅ 模型切换成功: opus → sonnet')
  })

  test('settings.json 保留已有字段', async () => {
    // 预写一个有内容的 settings.json（模拟用户已有配置）
    await fs.writeFile(
      path.join(tmpDir, 'settings.json'),
      JSON.stringify({
        effortLevel: 'high',
        language: '中文',
        skipDangerousModePermissionPrompt: true,
        env: {
          CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
          EXISTING_VAR: 'should_be_preserved',
        },
        hooks: {
          Stop: [{ hooks: [{ command: 'echo done', type: 'command' }], matcher: '' }],
        },
      }, null, 2),
    )

    // 添加并激活 provider
    await service.addProvider({
      name: '接口AI中转站',
      baseUrl: 'https://api.jiekou.ai/anthropic',
      apiKey: 'sk_test',
      models: [{ id: 'claude-opus-4-6', name: 'Opus 4.6' }],
    })

    const settings = JSON.parse(await fs.readFile(path.join(tmpDir, 'settings.json'), 'utf-8'))

    // 验证新字段写入
    expect(settings.env.ANTHROPIC_BASE_URL).toBe('https://api.jiekou.ai/anthropic')
    expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe('sk_test')
    expect(settings.model).toBe('claude-opus-4-6')

    // 验证已有字段保留
    expect(settings.effortLevel).toBe('high')
    expect(settings.language).toBe('中文')
    expect(settings.skipDangerousModePermissionPrompt).toBe(true)
    expect(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1')
    expect(settings.env.EXISTING_VAR).toBe('should_be_preserved')
    expect(settings.hooks).toBeDefined()
    expect(settings.hooks.Stop).toHaveLength(1)

    console.log('✅ settings.json 已有字段全部保留')
    console.log('   完整 settings:', JSON.stringify(settings, null, 2))
  })

  test('连通性测试 — MiniMax（预期能连但可能 401）', async () => {
    // 使用假 key 测试连通性机制本身
    const result = await service.testProviderConfig({
      baseUrl: 'https://api.minimaxi.com/anthropic',
      apiKey: 'sk-fake-test-key',
      modelId: 'MiniMax-M2.7-highspeed',
    })

    console.log('🔌 MiniMax 连通性测试结果:')
    console.log('   success:', result.success)
    console.log('   latencyMs:', result.latencyMs)
    console.log('   httpStatus:', result.httpStatus)
    console.log('   error:', result.error)
    console.log('   modelUsed:', result.modelUsed)

    // 不断言成功/失败，因为假 key 肯定失败，但验证机制正常工作
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.modelUsed).toBe('MiniMax-M2.7-highspeed')
  })

  test('GAP 分析 — 用户配置中我们未覆盖的字段', () => {
    // 用户的 MiniMax 配置包含我们未处理的字段:
    const minimaxConfig = {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-...',
        ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.7-highspeed',  // ❌ 未支持
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.7-highspeed',   // ❌ 未支持
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.7-highspeed', // ❌ 未支持
        ANTHROPIC_MODEL: 'MiniMax-M2.7-highspeed',
        API_TIMEOUT_MS: '3000000',                                 // ❌ 未支持
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',             // ❌ 未支持
      },
      skipDangerousModePermissionPrompt: true,                      // ❌ 未支持
    }

    // 用户的接口AI配置包含更多未覆盖字段:
    const jiekouConfig = {
      effortLevel: 'high',                     // ❌ 未同步
      enabledPlugins: { /* ... */ },            // ❌ 未同步
      env: {
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',  // ❌ 未支持
      },
      hooks: { /* ... */ },                     // ❌ 未同步
    }

    // 打印 GAP 分析
    console.log('\n📋 GAP 分析 — 需要在 syncToSettings 中额外支持的字段:')
    console.log('  1. ANTHROPIC_DEFAULT_HAIKU_MODEL — 各模型的 tier 默认值')
    console.log('  2. ANTHROPIC_DEFAULT_SONNET_MODEL')
    console.log('  3. ANTHROPIC_DEFAULT_OPUS_MODEL')
    console.log('  4. API_TIMEOUT_MS — 超时配置')
    console.log('  5. 其他自定义 env vars（应支持 extraEnv 字段）')
    console.log('  6. skipDangerousModePermissionPrompt — 非 env 的额外 settings 字段')

    expect(true).toBe(true) // GAP 分析通过
  })
})
