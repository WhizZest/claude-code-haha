/**
 * Filesystem browser API — returns directory listings for the DirectoryPicker component.
 */

import * as path from 'path'
import * as fs from 'fs'

export async function handleFilesystemRoute(pathname: string, url: URL): Promise<Response> {
  if (pathname === '/api/filesystem/browse') {
    return handleBrowse(url)
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
}

async function handleBrowse(url: URL): Promise<Response> {
  const targetPath = url.searchParams.get('path') || process.env.HOME || '/'
  const resolvedPath = path.resolve(targetPath)

  try {
    const stat = fs.statSync(resolvedPath)
    if (!stat.isDirectory()) {
      return json({ error: 'Not a directory', path: resolvedPath }, 400)
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        path: path.join(resolvedPath, e.name),
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return json({
      currentPath: resolvedPath,
      parentPath: path.dirname(resolvedPath),
      entries: dirs,
    })
  } catch (err) {
    return json({ error: `Cannot read directory: ${err}`, path: resolvedPath }, 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
