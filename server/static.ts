import { readFile } from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import { extname, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

// Serves the built frontend from dist/; returns false when there is no such file.
export const serveStatic = async (pathname: string, res: ServerResponse): Promise<boolean> => {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1)
  const file = normalize(`${DIST_DIR}${relative}`)
  if (!file.startsWith(DIST_DIR) || file.endsWith(sep)) return false

  try {
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    })
    res.end(body)
    return true
  } catch {
    return false
  }
}
