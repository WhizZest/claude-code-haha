/**
 * TeamWatcher -- monitors ~/.claude/teams/ for changes and pushes
 * real-time updates to all connected WebSocket clients.
 *
 * Uses polling (setInterval) rather than fs.watch for cross-platform reliability.
 * Detects three kinds of events:
 *   - team_created  : a new team directory with config.json appears
 *   - team_update   : an existing team's config.json content changes
 *   - team_deleted  : a previously-seen team directory disappears
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { sendToSession, getActiveSessionIds } from '../ws/handler.js'
import type { ServerMessage, TeamMemberStatus } from '../ws/events.js'

// ─── Helpers ──────────────────────────────────────────────────────────────

function getTeamsDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  return path.join(configDir, 'teams')
}

// ─── TeamWatcher ──────────────────────────────────────────────────────────

export class TeamWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private lastSnapshots = new Map<string, string>() // teamName -> raw JSON content

  /** Start polling for team changes. */
  start(intervalMs = 3000): void {
    if (this.intervalId) return // already running
    // Run an initial check immediately, then start the interval
    this.check()
    this.intervalId = setInterval(() => this.check(), intervalMs)
  }

  /** Stop polling. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /** Visible for testing -- force a single poll cycle. */
  checkNow(): void {
    this.check()
  }

  /** Clear internal snapshot state (useful in tests). */
  reset(): void {
    this.lastSnapshots.clear()
  }

  // ── Core polling logic ─────────────────────────────────────────────────

  private check(): void {
    const teamsDir = getTeamsDir()

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(teamsDir, { withFileTypes: true })
    } catch {
      // teams directory doesn't exist yet -- nothing to watch
      // If we previously knew about teams, they are now all "deleted"
      for (const [name] of this.lastSnapshots) {
        this.broadcast({ type: 'team_deleted', teamName: name })
      }
      this.lastSnapshots.clear()
      return
    }

    const currentTeamNames = new Set<string>()

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const teamName = entry.name
      currentTeamNames.add(teamName)

      const configPath = path.join(teamsDir, teamName, 'config.json')
      let content: string
      try {
        content = fs.readFileSync(configPath, 'utf-8')
      } catch {
        // config.json not readable (missing / permissions) -- skip
        continue
      }

      const lastContent = this.lastSnapshots.get(teamName)

      if (lastContent === undefined) {
        // New team detected
        this.lastSnapshots.set(teamName, content)
        this.broadcast({ type: 'team_created', teamName })
      } else if (content !== lastContent) {
        // Team config changed -- extract member statuses and broadcast
        this.lastSnapshots.set(teamName, content)
        try {
          const config = JSON.parse(content)
          const members = this.extractMemberStatuses(config)
          this.broadcast({ type: 'team_update', teamName, members })
        } catch {
          // JSON parse failed -- broadcast with empty members
          this.broadcast({ type: 'team_update', teamName, members: [] })
        }
      }
      // else: content unchanged, nothing to do
    }

    // Check for deleted teams (were in lastSnapshots but no longer on disk)
    for (const [name] of this.lastSnapshots) {
      if (!currentTeamNames.has(name)) {
        this.lastSnapshots.delete(name)
        this.broadcast({ type: 'team_deleted', teamName: name })
      }
    }
  }

  // ── Member status extraction ───────────────────────────────────────────

  /**
   * Parse the TeamFile config and derive a TeamMemberStatus for each member.
   *
   * The raw config has:
   *   members: [{ agentId, name, agentType, isActive, sessionId, ... }]
   *
   * We map `isActive` to the status enum and use `agentType` / `name` as role.
   */
  extractMemberStatuses(config: Record<string, unknown>): TeamMemberStatus[] {
    const members = config.members
    if (!Array.isArray(members)) return []

    return members.map((m: Record<string, unknown>) => {
      const status = this.deriveStatus(m.isActive as boolean | undefined)
      return {
        agentId: (m.agentId as string) || '',
        role: (m.agentType as string) || (m.name as string) || 'member',
        status,
        currentTask: (m.currentTask as string) || undefined,
      }
    })
  }

  private deriveStatus(isActive: boolean | undefined): TeamMemberStatus['status'] {
    if (isActive === false) return 'idle'
    // isActive === true or undefined => running
    return 'running'
  }

  // ── Broadcasting ───────────────────────────────────────────────────────

  private broadcast(message: ServerMessage): void {
    const sessionIds = getActiveSessionIds()
    for (const id of sessionIds) {
      sendToSession(id, message)
    }
  }
}

export const teamWatcher = new TeamWatcher()
