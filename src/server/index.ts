/**
 * Claude Code Desktop App — HTTP + WebSocket Server
 *
 * 为桌面端 UI 提供 REST API 和 WebSocket 实时通信。
 * 读写与 CLI 完全相同的文件系统，确保 CLI/UI 数据互通。
 */

import { handleApiRequest } from './router.js'
import { handleWebSocket, type WebSocketData } from './ws/handler.js'
import { corsHeaders } from './middleware/cors.js'
import { requireAuth } from './middleware/auth.js'
import { teamWatcher } from './services/teamWatcher.js'
import { cronScheduler } from './services/cronScheduler.js'

const PORT = parseInt(process.env.SERVER_PORT || '3456', 10)
const HOST = process.env.SERVER_HOST || '127.0.0.1'

export function startServer(port = PORT, host = HOST) {
  const localConnectHost =
    host === '0.0.0.0' || host === '127.0.0.1' || host === 'localhost'
      ? '127.0.0.1'
      : host

  /**
   * Auth is required when explicitly opted in or when bound to a non-localhost address.
   * - Default localhost dev: no auth needed (tests pass as-is).
   * - Production / non-localhost (e.g. 0.0.0.0): auth enforced automatically.
   * - Explicit opt-in: SERVER_AUTH_REQUIRED=1 forces auth even on localhost.
   */
  const authRequired = process.env.SERVER_AUTH_REQUIRED === '1' || host !== '127.0.0.1'

  const server = Bun.serve<WebSocketData>({
    port,
    hostname: host,

    async fetch(req, server) {
      const url = new URL(req.url)

      const origin = req.headers.get('Origin')

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin) })
      }

      // WebSocket upgrade
      if (url.pathname.startsWith('/ws/')) {
        // Enforce authentication when required
        if (authRequired) {
          const authError = requireAuth(req)
          if (authError) {
            const headers = new Headers(authError.headers)
            for (const [key, value] of Object.entries(corsHeaders(origin))) {
              headers.set(key, value)
            }
            return new Response(authError.body, { status: authError.status, headers })
          }
        }

        // Validate session ID format
        const sessionId = url.pathname.split('/').pop() || ''
        if (!sessionId || !/^[0-9a-zA-Z_-]{1,64}$/.test(sessionId)) {
          return new Response('Invalid session ID', { status: 400 })
        }
        const upgraded = server.upgrade(req, {
          data: {
            sessionId,
            connectedAt: Date.now(),
            channel: 'client',
            sdkToken: null,
            serverPort: port,
            serverHost: localConnectHost,
          },
        })
        if (upgraded) return undefined
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      // Internal SDK WebSocket used by the spawned Claude CLI.
      if (url.pathname.startsWith('/sdk/')) {
        const sessionId = url.pathname.split('/').pop() || ''
        if (!sessionId || !/^[0-9a-zA-Z_-]{1,64}$/.test(sessionId)) {
          return new Response('Invalid session ID', { status: 400 })
        }
        const upgraded = server.upgrade(req, {
          data: {
            sessionId,
            connectedAt: Date.now(),
            channel: 'sdk',
            sdkToken: url.searchParams.get('token'),
            serverPort: port,
            serverHost: localConnectHost,
          },
        })
        if (upgraded) return undefined
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      // REST API
      if (url.pathname.startsWith('/api/')) {
        // Enforce authentication when required
        if (authRequired) {
          const authError = requireAuth(req)
          if (authError) {
            const headers = new Headers(authError.headers)
            for (const [key, value] of Object.entries(corsHeaders(origin))) {
              headers.set(key, value)
            }
            return new Response(authError.body, { status: authError.status, headers })
          }
        }

        try {
          const response = await handleApiRequest(req, url)
          // Add CORS headers to all responses
          const headers = new Headers(response.headers)
          for (const [key, value] of Object.entries(corsHeaders(origin))) {
            headers.set(key, value)
          }
          return new Response(response.body, {
            status: response.status,
            headers,
          })
        } catch (error) {
          console.error('[Server] API error:', error)
          return Response.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders() }
          )
        }
      }

      // Health check
      if (url.pathname === '/health') {
        return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
      }

      return new Response('Not Found', { status: 404 })
    },

    websocket: handleWebSocket,
  })

  // Start watching ~/.claude/teams/ for real-time WebSocket push
  teamWatcher.start()

  // Start the cron scheduler to execute scheduled tasks
  cronScheduler.start()

  console.log(`[Server] Claude Code API server running at http://${host}:${port}`)
  return server
}

// Direct execution
if (import.meta.main) {
  startServer()
}
