/**
 * CORS middleware for local desktop app communication
 */

export function corsHeaders(origin?: string | null): Record<string, string> {
  // Only allow localhost origins for security
  const allowedOrigin =
    origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ? origin
      : 'http://localhost:3000'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}
