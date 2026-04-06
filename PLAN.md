# 模型配置重构计划 — Provider 管理系统

## 背景

当前项目的模型配置存在以下问题：
- 模型列表硬编码在 `src/server/api/models.ts` 的 `AVAILABLE_MODELS` 数组中
- 不支持自定义 Provider（供应商）
- 不支持自定义 Base URL 和 API Key
- 无法测试模型连通性
- 无法管理多个 Provider 并在它们之间切换

## 设计原则

1. **非侵入性** — 不修改 Claude Code 原生 settings.json 的 schema，通过 `env` 字段注入环境变量
2. **简洁** — 不过度设计，只实现核心功能：Provider CRUD、激活切换、连通性测试
3. **兼容** — 借鉴 cc-switch 的激活机制，通过写入 `settings.json` 的 `env` 字段实现 Provider 切换

## 核心机制

Claude Code 的 settings.json 支持 `env` 字段，会在启动时注入到 `process.env`：
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx"
  },
  "model": "claude-opus-4-6"
}
```

**激活 Provider = 将其 baseUrl/apiKey/model 写入 settings.json 的 env 字段**

---

## 数据模型

### Provider 类型定义

```typescript
// src/server/types/provider.ts

interface ProviderModel {
  id: string           // 模型 ID，如 "claude-opus-4-6"
  name: string         // 显示名称，如 "Opus 4.6"
  description?: string // 简短描述
  context?: string     // 上下文窗口，如 "200k"
}

interface Provider {
  id: string           // UUID
  name: string         // 显示名称，如 "Anthropic 官方"、"OpenRouter"
  baseUrl: string      // API Base URL
  apiKey: string       // API Key
  models: ProviderModel[]  // 该 Provider 支持的模型列表
  isActive: boolean    // 是否为当前激活的 Provider
  createdAt: number    // 创建时间戳
  updatedAt: number    // 更新时间戳
  notes?: string       // 备注
}
```

### 存储格式

文件路径：`~/.claude/providers.json`

```json
{
  "providers": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Anthropic 官方",
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "sk-ant-xxx",
      "models": [
        { "id": "claude-opus-4-6", "name": "Opus 4.6", "description": "Most capable", "context": "200k" },
        { "id": "claude-sonnet-4-6", "name": "Sonnet 4.6", "description": "Most efficient", "context": "200k" },
        { "id": "claude-haiku-4-5", "name": "Haiku 4.5", "description": "Fastest", "context": "200k" }
      ],
      "isActive": true,
      "createdAt": 1712476800000,
      "updatedAt": 1712476800000
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "OpenRouter",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "sk-or-xxx",
      "models": [
        { "id": "anthropic/claude-opus-4-6", "name": "Claude Opus 4.6", "context": "200k" }
      ],
      "isActive": false,
      "createdAt": 1712476800000,
      "updatedAt": 1712476800000
    }
  ],
  "activeModel": "claude-opus-4-6",
  "version": 1
}
```

---

## 实现步骤

### Step 1: Provider 服务层 (`src/server/services/providerService.ts`)

创建 `ProviderService` 类，负责：

- `listProviders()` — 读取 `~/.claude/providers.json` 并返回 provider 列表
- `getProvider(id)` — 获取单个 provider
- `getActiveProvider()` — 获取当前激活的 provider
- `addProvider(data)` — 添加新 provider（自动生成 UUID）
- `updateProvider(id, data)` — 更新 provider 信息
- `deleteProvider(id)` — 删除 provider（不允许删除激活中的 provider）
- `activateProvider(id, modelId)` — 激活 provider 并选择模型
  - 将旧 provider 设为 `isActive: false`
  - 将新 provider 设为 `isActive: true`
  - 写入 `~/.claude/settings.json` 的 `env` 字段：
    ```json
    {
      "env": {
        "ANTHROPIC_BASE_URL": "<provider.baseUrl>",
        "ANTHROPIC_AUTH_TOKEN": "<provider.apiKey>"
      },
      "model": "<modelId>"
    }
    ```
- `testProvider(id)` / `testProviderConfig(baseUrl, apiKey, modelId)` — 连通性测试
  - 向 `baseUrl/v1/messages` 发送一个最小请求（max_tokens=1, "Hi"）
  - 返回 `{ success, latencyMs, error?, modelUsed? }`

### Step 2: Provider REST API (`src/server/api/providers.ts`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/providers` | 获取 provider 列表 |
| GET | `/api/providers/:id` | 获取单个 provider |
| POST | `/api/providers` | 添加 provider |
| PUT | `/api/providers/:id` | 更新 provider |
| DELETE | `/api/providers/:id` | 删除 provider |
| POST | `/api/providers/:id/activate` | 激活 provider 并选择模型 |
| POST | `/api/providers/:id/test` | 测试已保存 provider 的连通性 |
| POST | `/api/providers/test` | 测试未保存配置的连通性（用于添加时预检） |

### Step 3: 注册路由 (`src/server/router.ts`)

在 router 中添加 `providers` 路由：
```typescript
case 'providers':
  return handleProvidersApi(req, url, segments)
```

### Step 4: 重构 Models API (`src/server/api/models.ts`)

修改现有的 `/api/models` 端点：
- **GET `/api/models`** — 不再返回硬编码列表，而是从当前激活的 Provider 读取模型列表
- **GET `/api/models/current`** — 从 providers.json 的 `activeModel` 读取
- **PUT `/api/models/current`** — 更新 `activeModel` 并同步到 settings.json

保留 Effort Level 相关 API 不变。

### Step 5: Provider 类型定义 (`src/server/types/provider.ts`)

独立的类型文件，包含：
- `Provider` 接口
- `ProviderModel` 接口
- `ProviderTestResult` 接口
- `ProvidersConfig` 接口（providers.json 的根类型）
- Zod schema 验证

---

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新建 | `src/server/types/provider.ts` | Provider 类型定义和 Zod schema |
| 新建 | `src/server/services/providerService.ts` | Provider 服务层（CRUD + 激活 + 测试） |
| 新建 | `src/server/api/providers.ts` | Provider REST API 路由处理 |
| 修改 | `src/server/router.ts` | 注册 `/api/providers` 路由 |
| 修改 | `src/server/api/models.ts` | 从 Provider 动态读取模型列表 |

**总计**: 3 个新文件 + 2 个修改文件

---

## 激活流程图

```
用户选择 Provider "OpenRouter" + 模型 "claude-opus-4-6"
  │
  ├─ 1. 更新 providers.json
  │     - 旧 provider: isActive = false
  │     - 新 provider: isActive = true
  │     - activeModel = "claude-opus-4-6"
  │
  ├─ 2. 读取当前 ~/.claude/settings.json
  │
  ├─ 3. 合并写入 settings.json
  │     {
  │       ...existingSettings,
  │       "env": {
  │         ...existingEnv,
  │         "ANTHROPIC_BASE_URL": "https://openrouter.ai/api/v1",
  │         "ANTHROPIC_AUTH_TOKEN": "sk-or-xxx"
  │       },
  │       "model": "claude-opus-4-6"
  │     }
  │
  └─ 4. 返回成功响应
```

## 连通性测试流程

```
POST /api/providers/test
Body: { baseUrl, apiKey, modelId }
  │
  ├─ 1. 构造最小请求
  │     POST {baseUrl}/v1/messages
  │     Headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
  │     Body: { model: modelId, max_tokens: 1, messages: [{ role: "user", content: "Hi" }] }
  │
  ├─ 2. 记录开始时间
  │
  ├─ 3. 发送请求（超时 15 秒）
  │
  └─ 4. 返回结果
        成功: { success: true, latencyMs: 850, modelUsed: "claude-opus-4-6" }
        失败: { success: false, error: "401 Unauthorized", latencyMs: 200 }
```

---

## 不在本次范围内

- 前端 UI 组件（后续单独实现）
- Provider 图标管理
- API Key 加密存储（V2 考虑）
- 多 API 格式支持（OpenAI 兼容等，V2 考虑）
- Provider 导入/导出
- 自动故障转移（failover）
