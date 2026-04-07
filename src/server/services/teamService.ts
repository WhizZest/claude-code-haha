/**
 * TeamService — 读取 CLI 生成的 Agent Teams 配置
 *
 * Team 配置存储在 ~/.claude/teams/{name}/config.json
 * 成员 transcript 存储为 JSONL 文件，通过 sessionId 在 ~/.claude/projects/ 下定位。
 * 服务端只读取，不负责创建团队（由 CLI 的 TeamCreate 工具完成）。
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { ApiError } from '../middleware/errorHandler.js'

// ─── Types ─────────────────────────────────────────────────────────────────

export type TeamMember = {
  agentId: string
  name: string
  agentType?: string
  model?: string
  color?: string
  status: 'running' | 'completed' | 'idle' | 'failed'
  joinedAt: number
  cwd: string
  sessionId?: string
}

export type TeamSummary = {
  name: string
  description?: string
  createdAt: number
  memberCount: number
  activeMemberCount: number
}

export type TeamDetail = TeamSummary & {
  leadAgentId: string
  members: TeamMember[]
}

export type TranscriptMessage = {
  id: string
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result'
  content: unknown
  timestamp: string
}

/** Raw config.json structure written by CLI */
type TeamFileRaw = {
  name: string
  description?: string
  createdAt: number
  leadAgentId: string
  leadSessionId?: string
  members: Array<{
    agentId: string
    name: string
    agentType?: string
    model?: string
    prompt?: string
    color?: string
    joinedAt: number
    tmuxPaneId: string
    cwd: string
    worktreePath?: string
    sessionId?: string
    isActive?: boolean
    mode?: string
  }>
}

// ─── Service ───────────────────────────────────────────────────────────────

export class TeamService {
  private getConfigDir(): string {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  }

  private getTeamsDir(): string {
    return path.join(this.getConfigDir(), 'teams')
  }

  private getProjectsDir(): string {
    return path.join(this.getConfigDir(), 'projects')
  }

  // ── List all teams ──────────────────────────────────────────────────────

  async listTeams(): Promise<TeamSummary[]> {
    const teamsDir = this.getTeamsDir()

    try {
      await fs.access(teamsDir)
    } catch {
      return []
    }

    const entries = await fs.readdir(teamsDir, { withFileTypes: true })
    const teams: TeamSummary[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      try {
        const config = await this.loadTeamConfig(entry.name)
        teams.push(this.toSummary(config))
      } catch {
        // Skip malformed team directories
      }
    }

    return teams
  }

  // ── Get team detail ─────────────────────────────────────────────────────

  async getTeam(name: string): Promise<TeamDetail> {
    const config = await this.loadTeamConfig(name)

    const members: TeamMember[] = config.members.map((m) => ({
      agentId: m.agentId,
      name: m.name,
      agentType: m.agentType,
      model: m.model,
      color: m.color,
      status: this.deriveStatus(m.isActive),
      joinedAt: m.joinedAt,
      cwd: m.cwd,
      sessionId: m.sessionId,
    }))

    return {
      ...this.toSummary(config),
      leadAgentId: config.leadAgentId,
      members,
    }
  }

  // ── Get member transcript ───────────────────────────────────────────────

  async getMemberTranscript(
    teamName: string,
    agentId: string,
  ): Promise<TranscriptMessage[]> {
    const config = await this.loadTeamConfig(teamName)

    const member = config.members.find((m) => m.agentId === agentId)
    if (!member) {
      throw ApiError.notFound(
        `Member not found: ${agentId} in team ${teamName}`,
      )
    }

    if (!member.sessionId) {
      return []
    }

    const jsonlPath = await this.findTranscriptFile(member.sessionId)
    if (!jsonlPath) {
      return []
    }

    return this.parseTranscriptFile(jsonlPath)
  }

  // ── Delete team ─────────────────────────────────────────────────────────

  async deleteTeam(name: string): Promise<void> {
    const config = await this.loadTeamConfig(name)

    const hasActive = config.members.some(
      (m) => m.isActive === undefined || m.isActive === true,
    )
    if (hasActive) {
      throw ApiError.conflict(
        `Cannot delete team "${name}": has active members`,
      )
    }

    const teamDir = path.join(this.getTeamsDir(), name)
    await fs.rm(teamDir, { recursive: true, force: true })
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async loadTeamConfig(name: string): Promise<TeamFileRaw> {
    const configPath = path.join(this.getTeamsDir(), name, 'config.json')

    try {
      const raw = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(raw) as TeamFileRaw
    } catch {
      throw ApiError.notFound(`Team not found: ${name}`)
    }
  }

  private toSummary(config: TeamFileRaw): TeamSummary {
    const activeMemberCount = config.members.filter(
      (m) => m.isActive === undefined || m.isActive === true,
    ).length

    return {
      name: config.name,
      description: config.description,
      createdAt: config.createdAt,
      memberCount: config.members.length,
      activeMemberCount,
    }
  }

  private deriveStatus(
    isActive: boolean | undefined,
  ): 'running' | 'completed' | 'idle' | 'failed' {
    if (isActive === false) return 'idle'
    // isActive === undefined || isActive === true
    return 'running'
  }

  /** Search ~/.claude/projects/ for a JSONL file matching the sessionId. */
  private async findTranscriptFile(
    sessionId: string,
  ): Promise<string | null> {
    const projectsDir = this.getProjectsDir()

    try {
      await fs.access(projectsDir)
    } catch {
      return null
    }

    const projectEntries = await fs.readdir(projectsDir, {
      withFileTypes: true,
    })

    for (const entry of projectEntries) {
      if (!entry.isDirectory()) continue

      const candidate = path.join(projectsDir, entry.name, `${sessionId}.jsonl`)
      try {
        await fs.access(candidate)
        return candidate
      } catch {
        // Not in this project directory
      }
    }

    return null
  }

  /** Parse a JSONL transcript file into messages. */
  private async parseTranscriptFile(
    filePath: string,
  ): Promise<TranscriptMessage[]> {
    const raw = await fs.readFile(filePath, 'utf-8')
    const lines = raw.split('\n').filter((line) => line.trim().length > 0)

    const messages: TranscriptMessage[] = []

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>

        // Skip non-message entries (snapshots, meta, etc.)
        const entryType = entry.type as string | undefined
        if (
          entryType !== 'user' &&
          entryType !== 'assistant' &&
          entryType !== 'system' &&
          entryType !== 'tool_use' &&
          entryType !== 'tool_result'
        ) {
          continue
        }

        // Skip meta entries
        if (entry.isMeta) continue

        const message: TranscriptMessage = {
          id: (entry.uuid as string) || crypto.randomUUID(),
          type: entryType as TranscriptMessage['type'],
          content: entry.message ?? entry.content ?? null,
          timestamp:
            (entry.timestamp as string) || new Date().toISOString(),
        }

        messages.push(message)
      } catch {
        // Skip unparseable lines
      }
    }

    return messages
  }
}

export const teamService = new TeamService()
