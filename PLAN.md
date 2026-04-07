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

---
---

# Scheduled Tasks Enhancement Plan

## Overview

改进定时任务功能：支持编辑、新增工作目录选择、复用 sessions 组件。

参考官方 Claude Code 桌面端 APP 的 "New scheduled task" 对话框实现。

---

## Phase 1: Data Model Extension

### 1.1 扩展 CronTask 类型 (`src/utils/cronTasks.ts`)

在现有 `CronTask` 类型中新增以下字段：

```typescript
type CronTask = {
  // ... existing fields ...
  
  /** Human-readable task name (e.g. "daily-code-review") */
  name?: string
  /** Task description (e.g. "Review yesterday's commits") */
  description?: string
  /** Working directory for the task execution */
  folder?: string
  /** Model to use (e.g. "claude-opus-4-6", "claude-sonnet-4-6") */
  model?: string
  /** Permission mode: "ask" | "auto-accept" | "plan" | "bypass" */
  permissionMode?: string
  /** Whether to use git worktree for execution */
  worktree?: boolean
  /** Schedule frequency for UI display: "manual" | "hourly" | "daily" | "weekdays" | "weekly" */
  frequency?: string
  /** Time string for scheduled execution (e.g. "09:00") - UI helper for daily/weekdays/weekly */
  scheduledTime?: string
}
```

**向后兼容**：所有新字段均为 optional，旧数据无需迁移。

### 1.2 更新存储 read/write (`src/utils/cronTasks.ts`)

- `readCronTasks()`: 在读取时保留新字段（name, description, folder, model, permissionMode, worktree, frequency, scheduledTime）
- `writeCronTasks()`: 在写入时包含新字段（仍然 strip `durable` 和 `agentId`）
- `addCronTask()`: 扩展函数签名接收新字段

### 1.3 新增 `updateCronTask()` 函数 (`src/utils/cronTasks.ts`)

```typescript
export async function updateCronTask(
  id: string,
  updates: Partial<Omit<CronTask, 'id' | 'createdAt'>>,
  dir?: string,
): Promise<boolean>
```

- 查找并更新内存中（session store）或磁盘上的任务
- 如果 cron 表达式变化，重新验证
- 返回是否找到并更新成功

---

## Phase 2: CronUpdateTool (`src/tools/ScheduleCronTool/CronUpdateTool.ts`)

### 2.1 创建新工具文件

参照 `CronCreateTool.ts` 和 `CronDeleteTool.ts` 的模式：

```typescript
const inputSchema = z.strictObject({
  id: z.string().describe('Job ID returned by CronCreate.'),
  cron: z.string().optional().describe('New cron expression'),
  prompt: z.string().optional().describe('New prompt'),
  name: z.string().optional().describe('New name'),
  description: z.string().optional().describe('New description'),
  folder: z.string().optional().describe('New working directory'),
  model: z.string().optional().describe('New model'),
  permissionMode: z.string().optional().describe('New permission mode'),
  worktree: z.boolean().optional().describe('New worktree setting'),
  recurring: z.boolean().optional().describe('New recurring setting'),
  frequency: z.string().optional().describe('New frequency'),
  scheduledTime: z.string().optional().describe('New time'),
})
```

### 2.2 更新 prompt.ts

- 新增 `CRON_UPDATE_TOOL_NAME = 'CronUpdate'`
- 添加 description 和 prompt 构建函数

### 2.3 更新 UI.tsx

- 新增 `renderUpdateToolUseMessage()` 和 `renderUpdateResultMessage()`

---

## Phase 3: UI Components (复用 sessions 组件)

**核心原则**：所有可复用的组件直接 import 使用，不复制代码。sessions 那边改了，这边自动生效。

### 3.1 频率到 Cron 表达式映射工具 (`src/utils/cronFrequency.ts`)

新建工具函数，在 UI 友好的频率设置和 cron 表达式之间互转：

```typescript
// Frequency → Cron
function frequencyToCron(frequency: string, time?: string): string
// "daily" + "09:00" → "0 9 * * *"
// "hourly" → "0 * * * *"
// "weekdays" + "09:00" → "0 9 * * 1-5"
// "weekly" + "09:00" → "0 9 * * 1"

// Cron → Frequency (best effort)
function cronToFrequency(cron: string): { frequency: string; time?: string }
```

### 3.2 定时任务向导 (`src/components/scheduled-tasks/ScheduledTaskWizard.tsx`)

使用现有 **Wizard 框架** (`src/components/wizard/`)，创建多步骤向导：

```typescript
type ScheduledTaskWizardData = {
  name: string
  description: string
  prompt: string
  model?: string
  permissionMode?: string
  folder?: string
  worktree?: boolean
  frequency: string       // "manual" | "hourly" | "daily" | "weekdays" | "weekly"
  scheduledTime?: string  // "09:00"
  cron?: string           // 最终生成的 cron 表达式
}

// 支持 create 和 edit 两种模式
type Props = {
  mode: 'create' | 'edit'
  initialData?: Partial<ScheduledTaskWizardData>  // edit 模式下预填充
  taskId?: string                                  // edit 模式下的任务 ID
  onComplete: (data: ScheduledTaskWizardData) => void
  onCancel: () => void
}
```

**向导步骤**（每步复用 sessions 组件）：

| Step | 组件 | 复用来源 |
|------|------|---------|
| 1. NameStep | `TextInput` | `src/components/TextInput.tsx` |
| 2. DescriptionStep | `TextInput` + external editor | `src/components/agents/new-agent-creation/wizard-steps/DescriptionStep.tsx` 的模式 |
| 3. PromptStep | `TextInput` + external editor | `src/components/agents/new-agent-creation/wizard-steps/PromptStep.tsx` 的模式 |
| 4. ModelStep | `ModelSelector` | **直接复用** `src/components/agents/ModelSelector.tsx` |
| 5. PermissionStep | `Select` | **直接复用** `src/components/CustomSelect/select.tsx` |
| 6. FolderStep | `Select` / `FuzzyPicker` | **复用** `src/components/CustomSelect/select.tsx` + `sessionStorage.ts` 的项目发现 |
| 7. ScheduleStep | `Select` + `TextInput` | **直接复用** `src/components/CustomSelect/select.tsx` |
| 8. ConfirmStep | Summary display | 使用 `Dialog` + `Text` 显示摘要 |

### 3.3 各步骤详细设计

#### Step 1: NameStep

```tsx
// 直接使用 TextInput，参照 DescriptionStep 模式
function NameStep(): ReactNode {
  const { goNext, goBack, updateWizardData, wizardData } = useWizard<ScheduledTaskWizardData>()
  // TextInput with validation: name is required
}
```

#### Step 4: ModelStep（复用 ModelSelector）

```tsx
import { ModelSelector } from '../../agents/ModelSelector.js'

function ModelStep(): ReactNode {
  const { goNext, updateWizardData, wizardData } = useWizard<ScheduledTaskWizardData>()
  return (
    <WizardDialogLayout subtitle="Select Model">
      <ModelSelector
        initialModel={wizardData.model}
        onComplete={(model) => {
          updateWizardData({ model })
          goNext()
        }}
        onCancel={goBack}
      />
    </WizardDialogLayout>
  )
}
```

#### Step 5: PermissionStep（复用 Select）

```tsx
import { Select } from '../../CustomSelect/select.js'

const permissionOptions = [
  { label: 'Ask permissions', value: 'ask', description: 'Always ask before making changes' },
  { label: 'Auto accept edits', value: 'auto-accept', description: 'Automatically accept all file edits' },
  { label: 'Plan mode', value: 'plan', description: 'Create a plan before making changes' },
  { label: 'Bypass permissions', value: 'bypass', description: 'Accepts all permissions', disabled: false },
]
```

#### Step 6: FolderStep（复用 sessionStorage 项目发现）

```tsx
import { loadAllProjectsMessageLogs } from '../../utils/sessionStorage.js'
// 或者直接读取 GlobalConfig.projects 获取最近项目列表

function FolderStep(): ReactNode {
  // 1. 从 GlobalConfig.projects 获取已知项目路径
  // 2. 使用 Select 展示 "Recent" 项目列表
  // 3. 最后一项 "Choose a different folder" 允许手动输入路径
}
```

#### Step 7: ScheduleStep（频率 + 时间）

```tsx
const frequencyOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Hourly', value: 'hourly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekdays', value: 'weekdays' },
  { label: 'Weekly', value: 'weekly' },
]

function ScheduleStep(): ReactNode {
  // 1. 选择频率 (Select 组件)
  // 2. 如果是 daily/weekdays/weekly，显示时间输入 (TextInput，格式 HH:MM)
  // 3. 使用 frequencyToCron() 转换为 cron 表达式
}
```

#### Step 8: ConfirmStep

```tsx
function ConfirmStep(): ReactNode {
  // 显示所有配置的摘要
  // Enter 确认创建/更新
  // Esc 返回上一步
}
```

---

## Phase 4: Integration

### 4.1 新增 /schedule-local Skill (`src/skills/bundled/scheduleLocal.ts`)

或修改现有 `/schedule` skill，添加本地定时任务的向导流程：

```typescript
// 用户输入 /schedule 时:
// 1. 如果没参数 → 显示 ScheduledTaskWizard (create 模式)
// 2. 如果参数是 task ID → 显示 ScheduledTaskWizard (edit 模式，预填充)
// 3. 如果参数是 "list" → 调用 CronList
```

### 4.2 注册 CronUpdateTool

在工具注册表中添加 CronUpdateTool：

- 更新 `src/tools/ScheduleCronTool/` 导出
- 确保工具在 `isKairosCronEnabled()` 条件下启用

### 4.3 更新 CronListTool 输出

在列表输出中包含新字段（name, description, folder, model 等），方便用户识别任务。

---

## Phase 5: Testing

### 5.1 单元测试

- `cronTasks.ts`: 测试 updateCronTask() 的各种场景（内存任务、磁盘任务、不存在的 ID）
- `cronFrequency.ts`: 测试频率到 cron 的双向转换
- `CronUpdateTool.ts`: 测试验证逻辑（无效 ID、权限检查）

### 5.2 集成测试

- 验证 wizard 创建的任务能被 scheduler 正确执行
- 验证编辑后的任务能正确更新 nextFireAt

---

## File Changes Summary

| File | Change Type | Description |
|------|------------|-------------|
| `src/utils/cronTasks.ts` | **Modified** | 扩展 CronTask 类型，新增 updateCronTask()，更新 read/write/add |
| `src/utils/cronFrequency.ts` | **New** | 频率 ↔ Cron 表达式转换工具 |
| `src/tools/ScheduleCronTool/CronUpdateTool.ts` | **New** | 编辑定时任务工具 |
| `src/tools/ScheduleCronTool/prompt.ts` | **Modified** | 新增 CronUpdate 的 name/description/prompt |
| `src/tools/ScheduleCronTool/UI.tsx` | **Modified** | 新增 update 的 render 函数 |
| `src/components/scheduled-tasks/ScheduledTaskWizard.tsx` | **New** | 定时任务向导（复用 sessions 组件） |
| `src/components/scheduled-tasks/steps/NameStep.tsx` | **New** | 名称输入步骤 |
| `src/components/scheduled-tasks/steps/DescriptionStep.tsx` | **New** | 描述输入步骤 |
| `src/components/scheduled-tasks/steps/PromptStep.tsx` | **New** | Prompt 输入步骤 |
| `src/components/scheduled-tasks/steps/ModelStep.tsx` | **New** | 模型选择步骤（复用 ModelSelector） |
| `src/components/scheduled-tasks/steps/PermissionStep.tsx` | **New** | 权限模式步骤（复用 Select） |
| `src/components/scheduled-tasks/steps/FolderStep.tsx` | **New** | 工作目录步骤（复用 Select + 项目发现） |
| `src/components/scheduled-tasks/steps/ScheduleStep.tsx` | **New** | 频率+时间步骤（复用 Select） |
| `src/components/scheduled-tasks/steps/ConfirmStep.tsx` | **New** | 确认步骤 |
| `src/skills/bundled/scheduleLocal.ts` | **New or Modified** | /schedule skill 集成向导 |
| `src/hooks/useScheduledTasks.ts` | **Modified** | 支持 folder/model/permissionMode/worktree 在任务执行时生效 |

## Key Reuse Points (复用列表)

确保以下组件是直接 import 复用，**不是复制代码**：

1. **`WizardProvider`** - `src/components/wizard/WizardProvider.tsx`
2. **`WizardDialogLayout`** - `src/components/wizard/WizardDialogLayout.tsx`
3. **`useWizard`** - `src/components/wizard/useWizard.ts`
4. **`WizardNavigationFooter`** - `src/components/wizard/WizardNavigationFooter.tsx`
5. **`ModelSelector`** - `src/components/agents/ModelSelector.tsx`
6. **`Select`** - `src/components/CustomSelect/select.tsx`
7. **`TextInput`** - `src/components/TextInput.tsx`
8. **`Dialog`** - `src/components/design-system/Dialog.tsx`
9. **`FuzzyPicker`** - `src/components/design-system/FuzzyPicker.tsx`（如 FolderStep 需要搜索）
10. **`useKeybinding`** - `src/hooks/useKeybinding.ts`
11. **Session Project Discovery** - `src/utils/sessionStorage.ts` (loadAllProjectsMessageLogs)
12. **`GlobalConfig.projects`** - `src/utils/config.ts`（最近项目列表）

## Implementation Order

1. Phase 1 (Data Model) → 2. Phase 2 (CronUpdateTool) → 3. Phase 3 (UI) → 4. Phase 4 (Integration) → 5. Phase 5 (Testing)

每个 Phase 完成后做一次代码审查。
