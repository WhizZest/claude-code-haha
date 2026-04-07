import { api } from './client'
import type { TeamSummary, TeamDetail, TranscriptMessage } from '../types/team'

type TeamsResponse = { teams: TeamSummary[] }
type TranscriptResponse = { messages: TranscriptMessage[] }

export const teamsApi = {
  list() {
    return api.get<TeamsResponse>('/api/teams')
  },

  get(name: string) {
    return api.get<TeamDetail>(`/api/teams/${encodeURIComponent(name)}`)
  },

  getMemberTranscript(teamName: string, agentId: string) {
    return api.get<TranscriptResponse>(
      `/api/teams/${encodeURIComponent(teamName)}/members/${encodeURIComponent(agentId)}/transcript`,
    )
  },

  delete(name: string) {
    return api.delete<{ ok: true }>(`/api/teams/${encodeURIComponent(name)}`)
  },
}
