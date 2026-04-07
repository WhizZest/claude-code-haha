import type { PermissionMode } from './settings'

// Source: src/server/ws/events.ts

// ─── Client → Server ──────────────────────────────────────────────

export type ClientMessage =
  | { type: 'user_message'; content: string; attachments?: AttachmentRef[] }
  | { type: 'permission_response'; requestId: string; allowed: boolean; rule?: string }
  | { type: 'set_permission_mode'; mode: PermissionMode }
  | { type: 'stop_generation' }
  | { type: 'ping' }

export type AttachmentRef = {
  type: 'file' | 'image'
  name?: string
  path?: string
  data?: string
  mimeType?: string
}

export type UIAttachment = {
  type: 'file' | 'image'
  name: string
  data?: string
  mimeType?: string
}

// ─── Server → Client ──────────────────────────────────────────────

export type ServerMessage =
  | { type: 'connected'; sessionId: string }
  | { type: 'content_start'; blockType: 'text' | 'tool_use'; toolName?: string; toolUseId?: string }
  | { type: 'content_delta'; text?: string; toolInput?: string }
  | { type: 'tool_use_complete'; toolName: string; toolUseId: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean }
  | { type: 'permission_request'; requestId: string; toolName: string; input: unknown; description?: string }
  | { type: 'message_complete'; usage: TokenUsage }
  | { type: 'thinking'; text: string }
  | { type: 'status'; state: ChatState; verb?: string; elapsed?: number; tokens?: number }
  | { type: 'error'; message: string; code: string; retryable?: boolean }
  | { type: 'system_notification'; subtype: string; message?: string; data?: unknown }
  | { type: 'pong' }
  | { type: 'team_update'; teamName: string; members: TeamMemberStatus[] }
  | { type: 'team_created'; teamName: string }
  | { type: 'team_deleted'; teamName: string }
  | { type: 'task_update'; taskId: string; status: string; progress?: string }

export type TokenUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
}

export type ChatState = 'idle' | 'thinking' | 'tool_executing' | 'streaming' | 'permission_pending'

export type TeamMemberStatus = {
  agentId: string
  role: string
  status: 'running' | 'idle' | 'completed' | 'error'
  currentTask?: string
}

// ─── UI Message model (rendered in MessageList) ───────────────────

export type UIMessage =
  | { id: string; type: 'user_text'; content: string; timestamp: number; attachments?: UIAttachment[] }
  | { id: string; type: 'assistant_text'; content: string; timestamp: number; model?: string }
  | { id: string; type: 'thinking'; content: string; timestamp: number }
  | { id: string; type: 'tool_use'; toolName: string; toolUseId: string; input: unknown; timestamp: number }
  | { id: string; type: 'tool_result'; toolUseId: string; content: unknown; isError: boolean; timestamp: number }
  | { id: string; type: 'system'; content: string; timestamp: number }
  | { id: string; type: 'permission_request'; requestId: string; toolName: string; input: unknown; description?: string; timestamp: number }
  | { id: string; type: 'error'; message: string; code: string; timestamp: number }
