/**
 * Agents REST API
 *
 * GET    /api/agents        — 获取 Agent 列表
 * GET    /api/agents/:name  — 获取 Agent 详情
 * POST   /api/agents        — 创建 Agent
 * PUT    /api/agents/:name  — 更新 Agent
 * DELETE /api/agents/:name  — 删除 Agent
 *
 * GET    /api/tasks         — 获取后台任务列表
 * GET    /api/tasks/:id     — 获取任务详情
 */

import { AgentService } from '../services/agentService.js'
import { taskService } from '../services/taskService.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

const agentService = new AgentService()

export async function handleAgentsApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const resource = segments[1] // 'agents' | 'tasks'

    if (resource === 'tasks') {
      return await handleTasksApi(req, segments)
    }

    return await handleAgents(req, segments)
  } catch (error) {
    return errorResponse(error)
  }
}

// ─── Agent CRUD ─────────────────────────────────────────────────────────────

async function handleAgents(
  req: Request,
  segments: string[],
): Promise<Response> {
  const method = req.method
  const agentName = segments[2] ? decodeURIComponent(segments[2]) : undefined

  // ── GET /api/agents ──────────────────────────────────────────────────
  if (method === 'GET' && !agentName) {
    const agents = await agentService.listAgents()
    return Response.json({ agents })
  }

  // ── GET /api/agents/:name ────────────────────────────────────────────
  if (method === 'GET' && agentName) {
    const agent = await agentService.getAgent(agentName)
    if (!agent) {
      throw ApiError.notFound(`Agent not found: ${agentName}`)
    }
    return Response.json({ agent })
  }

  // ── POST /api/agents ─────────────────────────────────────────────────
  if (method === 'POST' && !agentName) {
    const body = await parseJsonBody(req)
    if (!body.name || typeof body.name !== 'string') {
      throw ApiError.badRequest('Missing or invalid "name" in request body')
    }
    await agentService.createAgent({
      name: body.name as string,
      description: body.description as string | undefined,
      model: body.model as string | undefined,
      tools: body.tools as string[] | undefined,
      systemPrompt: body.systemPrompt as string | undefined,
      color: body.color as string | undefined,
    })
    return Response.json({ ok: true }, { status: 201 })
  }

  // ── PUT /api/agents/:name ────────────────────────────────────────────
  if (method === 'PUT' && agentName) {
    const body = await parseJsonBody(req)
    await agentService.updateAgent(agentName, body as Record<string, unknown>)
    const updated = await agentService.getAgent(agentName)
    return Response.json({ agent: updated })
  }

  // ── DELETE /api/agents/:name ─────────────────────────────────────────
  if (method === 'DELETE' && agentName) {
    await agentService.deleteAgent(agentName)
    return Response.json({ ok: true })
  }

  throw new ApiError(
    405,
    `Method ${method} not allowed on /api/agents${agentName ? `/${agentName}` : ''}`,
    'METHOD_NOT_ALLOWED',
  )
}

// ─── Tasks API ─────────────────────────────────────────────────────────────
//
// GET /api/tasks                         → list all tasks (across all task lists)
// GET /api/tasks/lists                   → list all task lists with summaries
// GET /api/tasks/lists/:taskListId       → get all tasks for a specific task list
// GET /api/tasks/lists/:taskListId/:id   → get a single task

async function handleTasksApi(
  req: Request,
  segments: string[],
): Promise<Response> {
  if (req.method !== 'GET') {
    throw new ApiError(
      405,
      `Method ${req.method} not allowed on /api/tasks`,
      'METHOD_NOT_ALLOWED',
    )
  }

  const sub = segments[2] // 'lists' or undefined

  // GET /api/tasks/lists — list all task lists
  if (sub === 'lists') {
    const taskListId = segments[3]
    const taskId = segments[4]

    if (taskListId && taskId) {
      // GET /api/tasks/lists/:taskListId/:taskId
      const task = await taskService.getTask(taskListId, taskId)
      if (!task) throw ApiError.notFound(`Task not found: ${taskListId}/${taskId}`)
      return Response.json({ task })
    }

    if (taskListId) {
      // GET /api/tasks/lists/:taskListId
      const tasks = await taskService.getTasksForList(taskListId)
      return Response.json({ tasks })
    }

    // GET /api/tasks/lists
    const lists = await taskService.listTaskLists()
    return Response.json({ lists })
  }

  // GET /api/tasks — list all tasks
  const tasks = await taskService.listTasks()
  return Response.json({ tasks })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }
}
