import { create } from 'zustand'
import { teamsApi } from '../api/teams'
import type { TeamSummary, TeamDetail, TeamMember, TranscriptMessage, AgentColor } from '../types/team'
import { AGENT_COLORS } from '../types/team'
import type { TeamMemberStatus } from '../types/chat'

type TeamStore = {
  teams: TeamSummary[]
  activeTeam: TeamDetail | null
  viewingAgentId: string | null
  agentTranscript: TranscriptMessage[]
  memberColors: Map<string, AgentColor>

  fetchTeams: () => Promise<void>
  fetchTeamDetail: (name: string) => Promise<void>
  fetchMemberTranscript: (teamName: string, agentId: string) => Promise<void>
  setViewingAgent: (agentId: string | null) => void
  clearTeam: () => void

  // WebSocket handlers
  handleTeamCreated: (teamName: string) => void
  handleTeamUpdate: (teamName: string, members: TeamMemberStatus[]) => void
  handleTeamDeleted: (teamName: string) => void
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  activeTeam: null,
  viewingAgentId: null,
  agentTranscript: [],
  memberColors: new Map(),

  fetchTeams: async () => {
    try {
      const { teams } = await teamsApi.list()
      set({ teams })
    } catch {
      // ignore
    }
  },

  fetchTeamDetail: async (name: string) => {
    try {
      const detail = await teamsApi.get(name)
      // Assign colors to members
      const colors = new Map<string, AgentColor>()
      detail.members.forEach((m, i) => {
        colors.set(m.agentId, AGENT_COLORS[i % AGENT_COLORS.length]!)
      })
      set({ activeTeam: detail, memberColors: colors })
    } catch {
      // ignore
    }
  },

  fetchMemberTranscript: async (teamName: string, agentId: string) => {
    try {
      const { messages } = await teamsApi.getMemberTranscript(teamName, agentId)
      set({ agentTranscript: messages, viewingAgentId: agentId })
    } catch {
      // ignore
    }
  },

  setViewingAgent: (agentId) => {
    if (!agentId) {
      set({ viewingAgentId: null, agentTranscript: [] })
    } else {
      set({ viewingAgentId: agentId })
      // Fetch transcript if we have an active team
      const team = get().activeTeam
      if (team) {
        get().fetchMemberTranscript(team.name, agentId)
      }
    }
  },

  clearTeam: () => set({ activeTeam: null, viewingAgentId: null, agentTranscript: [], memberColors: new Map() }),

  handleTeamCreated: (teamName: string) => {
    set((s) => ({
      teams: [...s.teams, { name: teamName, memberCount: 0 }],
    }))
    // Auto-fetch detail
    get().fetchTeamDetail(teamName)
  },

  handleTeamUpdate: (teamName: string, members: TeamMemberStatus[]) => {
    const team = get().activeTeam
    if (team && team.name === teamName) {
      const colors = get().memberColors
      const updatedMembers: TeamMember[] = members.map((m, i) => ({
        ...m,
        color: colors.get(m.agentId) ?? AGENT_COLORS[i % AGENT_COLORS.length]!,
      }))
      set({ activeTeam: { ...team, members: updatedMembers } })
    }
  },

  handleTeamDeleted: (teamName: string) => {
    set((s) => ({
      teams: s.teams.filter((t) => t.name !== teamName),
      activeTeam: s.activeTeam?.name === teamName ? null : s.activeTeam,
    }))
  },
}))
