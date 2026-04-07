// Source: src/server/services/teamService.ts, src/server/ws/events.ts

export type TeamSummary = {
  name: string
  memberCount: number
  createdAt?: string
}

export type TeamMember = {
  agentId: string
  role: string
  status: 'running' | 'idle' | 'completed' | 'error'
  currentTask?: string
  color?: AgentColor
}

export type TeamDetail = {
  name: string
  members: TeamMember[]
  createdAt?: string
}

export type TranscriptMessage = {
  id: string
  type: string
  content: unknown
  timestamp: string
}

export type AgentColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink' | 'cyan'

export const AGENT_COLORS: AgentColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']
