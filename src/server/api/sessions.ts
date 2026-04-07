/**
 * Session REST API Routes
 *
 * 提供会话的 CRUD 操作接口，数据来自 CLI 共享的 JSONL 文件。
 *
 * Routes:
 *   GET    /api/sessions            — 列出会话
 *   GET    /api/sessions/:id        — 获取会话详情
 *   GET    /api/sessions/:id/messages — 获取会话消息
 *   POST   /api/sessions            — 创建新会话
 *   DELETE /api/sessions/:id        — 删除会话
 *   PATCH  /api/sessions/:id        — 重命名会话
 */

import { sessionService } from '../services/sessionService.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'
import { getSlashCommands } from '../ws/handler.js'

export async function handleSessionsApi(
  req: Request,
  url: URL,
  segments: string[]
): Promise<Response> {
  try {
    // segments: ['api', 'sessions', ...rest]
    const sessionId = segments[2] // may be undefined
    const subResource = segments[3] // e.g. 'messages'

    // -----------------------------------------------------------------------
    // Collection routes: /api/sessions
    // -----------------------------------------------------------------------
    if (!sessionId) {
      switch (req.method) {
        case 'GET':
          return await listSessions(url)
        case 'POST':
          return await createSession(req)
        default:
          return Response.json(
            { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
            { status: 405 }
          )
      }
    }

    // Special collection route: /api/sessions/recent-projects
    if (sessionId === 'recent-projects' && req.method === 'GET') {
      return await getRecentProjects()
    }

    // -----------------------------------------------------------------------
    // Sub-resource routes: /api/sessions/:id/messages
    // -----------------------------------------------------------------------
    if (subResource === 'messages') {
      if (req.method !== 'GET') {
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 }
        )
      }
      return await getSessionMessages(sessionId)
    }

    if (subResource === 'git-info') {
      if (req.method !== 'GET') {
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 }
        )
      }
      return await getGitInfo(sessionId)
    }

    if (subResource === 'slash-commands') {
      if (req.method !== 'GET') {
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 }
        )
      }
      return Response.json({ commands: getSlashCommands(sessionId) })
    }

    // Route to conversations handler if sub-resource is 'chat'
    if (subResource === 'chat') {
      // This is handled by the conversations API, but in case the router
      // forwards it here, we delegate to the conversations module.
      // Normally the router should route /api/sessions/:id/chat/* to conversations.
      return Response.json(
        { error: 'NOT_FOUND', message: 'Use /api/sessions/:id/chat via conversations API' },
        { status: 404 }
      )
    }

    // -----------------------------------------------------------------------
    // Item routes: /api/sessions/:id
    // -----------------------------------------------------------------------
    switch (req.method) {
      case 'GET':
        return await getSession(sessionId)
      case 'DELETE':
        return await deleteSession(sessionId)
      case 'PATCH':
        return await patchSession(req, sessionId)
      default:
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 }
        )
    }
  } catch (error) {
    return errorResponse(error)
  }
}

// ============================================================================
// Handler implementations
// ============================================================================

async function listSessions(url: URL): Promise<Response> {
  const project = url.searchParams.get('project') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  if (isNaN(limit) || limit < 0) {
    throw ApiError.badRequest('Invalid limit parameter')
  }
  if (isNaN(offset) || offset < 0) {
    throw ApiError.badRequest('Invalid offset parameter')
  }

  const result = await sessionService.listSessions({ project, limit, offset })
  return Response.json(result)
}

async function getSession(sessionId: string): Promise<Response> {
  const detail = await sessionService.getSession(sessionId)
  if (!detail) {
    throw ApiError.notFound(`Session not found: ${sessionId}`)
  }
  return Response.json(detail)
}

async function getSessionMessages(sessionId: string): Promise<Response> {
  const messages = await sessionService.getSessionMessages(sessionId)
  return Response.json({ messages })
}

async function createSession(req: Request): Promise<Response> {
  let body: { workDir?: string }
  try {
    body = (await req.json()) as { workDir?: string }
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }

  if (!body.workDir || typeof body.workDir !== 'string') {
    throw ApiError.badRequest('workDir (string) is required in request body')
  }

  const result = await sessionService.createSession(body.workDir)
  return Response.json(result, { status: 201 })
}

async function deleteSession(sessionId: string): Promise<Response> {
  await sessionService.deleteSession(sessionId)
  return Response.json({ ok: true })
}

async function getGitInfo(sessionId: string): Promise<Response> {
  const workDir = await sessionService.getSessionWorkDir(sessionId)
  if (!workDir) {
    throw ApiError.notFound(`Session not found: ${sessionId}`)
  }

  try {
    // Get branch name
    const branchProc = Bun.spawn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const branchText = await new Response(branchProc.stdout).text()
    const branch = branchText.trim()

    // Get repo name from remote or directory
    let repoName = ''
    try {
      const remoteProc = Bun.spawn(['git', 'remote', 'get-url', 'origin'], {
        cwd: workDir,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const remoteText = await new Response(remoteProc.stdout).text()
      const remote = remoteText.trim()
      // Extract repo name from URL: git@github.com:user/repo.git or https://...repo.git
      const match = remote.match(/\/([^/]+?)(?:\.git)?$/) || remote.match(/:([^/]+\/[^/]+?)(?:\.git)?$/)
      repoName = match ? match[1]! : ''
    } catch {
      // No remote, use directory name
      const parts = workDir.split('/')
      repoName = parts[parts.length - 1] || ''
    }

    // Get short status
    const statusProc = Bun.spawn(['git', 'status', '--porcelain'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const statusText = await new Response(statusProc.stdout).text()
    const changedFiles = statusText.trim().split('\n').filter(Boolean).length

    return Response.json({
      branch,
      repoName,
      workDir,
      changedFiles,
    })
  } catch {
    // Not a git repo or git not available
    return Response.json({
      branch: null,
      repoName: null,
      workDir,
      changedFiles: 0,
    })
  }
}

async function patchSession(req: Request, sessionId: string): Promise<Response> {
  let body: { title?: string }
  try {
    body = (await req.json()) as { title?: string }
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }

  if (!body.title || typeof body.title !== 'string') {
    throw ApiError.badRequest('title (string) is required in request body')
  }

  await sessionService.renameSession(sessionId, body.title)
  return Response.json({ ok: true })
}

async function getRecentProjects(): Promise<Response> {
  const { sessions } = await sessionService.listSessions({ limit: 200 })
  const validSessions = sessions.filter((session) => session.workDirExists && session.workDir)

  // Group sessions by projectPath and find most recent per project
  const projectMap = new Map<string, { modifiedAt: string; sessionCount: number; sessionId: string }>()
  for (const s of validSessions) {
    const existing = projectMap.get(s.projectPath)
    if (!existing || s.modifiedAt > existing.modifiedAt) {
      projectMap.set(s.projectPath, {
        modifiedAt: existing ? s.modifiedAt : s.modifiedAt,
        sessionCount: (existing?.sessionCount ?? 0) + 1,
        sessionId: s.id,
      })
    } else {
      existing.sessionCount++
    }
  }

  // Build project list with real paths
  const projects: Array<{
    projectPath: string
    realPath: string
    projectName: string
    isGit: boolean
    repoName: string | null
    branch: string | null
    modifiedAt: string
    sessionCount: number
  }> = []

  for (const [projectPath, info] of projectMap) {
    // Try to get real workDir from the most recent session
    let realPath: string
    try {
      const workDir = await sessionService.getSessionWorkDir(info.sessionId)
      realPath = workDir || sessionService.desanitizePath(projectPath)
    } catch {
      realPath = sessionService.desanitizePath(projectPath)
    }

    const projectName = realPath.split('/').filter(Boolean).pop() || projectPath

    // Check if it's a git repo
    let isGit = false
    let repoName: string | null = null
    let branch: string | null = null
    try {
      const proc = Bun.spawn(['git', 'rev-parse', '--is-inside-work-tree'], {
        cwd: realPath, stdout: 'pipe', stderr: 'pipe',
      })
      const out = await new Response(proc.stdout).text()
      isGit = out.trim() === 'true'

      if (isGit) {
        const branchProc = Bun.spawn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], {
          cwd: realPath, stdout: 'pipe', stderr: 'pipe',
        })
        branch = (await new Response(branchProc.stdout).text()).trim() || null

        try {
          const remoteProc = Bun.spawn(['git', 'remote', 'get-url', 'origin'], {
            cwd: realPath, stdout: 'pipe', stderr: 'pipe',
          })
          const remote = (await new Response(remoteProc.stdout).text()).trim()
          const match = remote.match(/:([^/]+\/[^/]+?)(?:\.git)?$/) || remote.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/)
          repoName = match ? match[1]! : null
        } catch { /* no remote */ }
      }
    } catch { /* not a git repo or dir doesn't exist */ }

    projects.push({
      projectPath, realPath, projectName, isGit, repoName, branch,
      modifiedAt: info.modifiedAt, sessionCount: info.sessionCount,
    })
  }

  // Sort by most recent
  projects.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

  return Response.json({ projects: projects.slice(0, 10) })
}
