import type { ClientMessage, ServerMessage } from '../types/chat'
import { getBaseUrl } from './client'

type MessageHandler = (msg: ServerMessage) => void

class WebSocketManager {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private handlers = new Set<MessageHandler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private intentionalClose = false
  private pendingMessages: ClientMessage[] = []

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get currentSessionId() {
    return this.sessionId
  }

  connect(sessionId: string) {
    // Disconnect existing connection if switching sessions
    if (this.sessionId && this.sessionId !== sessionId) {
      this.disconnect()
    }

    this.sessionId = sessionId
    this.intentionalClose = false
    this.reconnectAttempt = 0

    const wsUrl = getBaseUrl().replace(/^http/, 'ws')
    this.ws = new WebSocket(`${wsUrl}/ws/${sessionId}`)

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this.startPingLoop()

      // Flush any pending messages that were queued before connection opened
      while (this.pendingMessages.length > 0) {
        const msg = this.pendingMessages.shift()!
        this.ws!.send(JSON.stringify(msg))
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage
        for (const handler of this.handlers) {
          handler(msg)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.stopPingLoop()
      if (!this.intentionalClose && this.sessionId) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // onclose will fire after onerror
    }
  }

  disconnect() {
    this.intentionalClose = true
    this.sessionId = null
    this.stopPingLoop()
    this.clearReconnect()
    this.pendingMessages = []

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      // Queue message to be sent when connection opens
      this.pendingMessages.push(message)
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.add(handler)
    return () => { this.handlers.delete(handler) }
  }

  /** Remove all message handlers — call before registering new ones */
  clearHandlers() {
    this.handlers.clear()
  }

  private startPingLoop() {
    this.stopPingLoop()
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' })
    }, 30_000)
  }

  private stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect() {
    this.clearReconnect()
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000)
    this.reconnectAttempt++

    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId)
      }
    }, delay)
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

export const wsManager = new WebSocketManager()
