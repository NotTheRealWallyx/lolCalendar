import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { FEED_PATH, SERVER_PORT } from './config'
import { buildCalendar } from './ics'
import { getEnabledMatches, listLeagues, refreshMatches, setLeagueEnabled } from './service'
import { serveStatic } from './static'

const MAX_BODY_BYTES = 10_000

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > MAX_BODY_BYTES) throw new Error('Request body too large')
  }
  return body ? JSON.parse(body) : {}
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

const handle = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const leagueMatch = url.pathname.match(/^\/api\/leagues\/([\w-]+)$/)

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/leagues') {
    sendJson(res, 200, { leagues: await listLeagues() })
    return
  }

  if (req.method === 'PUT' && leagueMatch?.[1]) {
    const body = (await readJsonBody(req)) as { enabled?: unknown }
    if (typeof body.enabled !== 'boolean') {
      sendJson(res, 400, { error: '"enabled" must be a boolean' })
      return
    }
    await setLeagueEnabled(leagueMatch[1], body.enabled)
    sendJson(res, 200, { slug: leagueMatch[1], enabled: body.enabled })
    return
  }

  if (req.method === 'GET' && url.pathname === FEED_PATH) {
    const { matches, lastFetchedAt, stale } = await getEnabledMatches()
    // An empty feed would make Calendar delete every event, so let it keep its copy instead.
    if (stale && lastFetchedAt === null) {
      sendJson(res, 503, { error: 'Schedule not available yet' })
      return
    }

    const regionBySlug = await listLeagues()
      .then((leagues) => new Map(leagues.map((l) => [l.slug, l.regionCode])))
      .catch(() => new Map<string, string>())

    res.writeHead(200, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache',
      ...(url.searchParams.has('download') && {
        'Content-Disposition': 'attachment; filename="lol-esports.ics"',
      }),
    })
    res.end(buildCalendar(matches, regionBySlug, new Date()))
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/matches') {
    sendJson(res, 200, await getEnabledMatches())
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/sync') {
    try {
      const diff = await refreshMatches(true)
      sendJson(res, 200, { diff })
    } catch (err) {
      sendJson(res, 502, { error: `Could not reach lolesports: ${errorMessage(err)}` })
    }
    return
  }

  if (req.method === 'GET' && (await serveStatic(url.pathname, res))) return

  sendJson(res, 404, { error: 'Not found' })
}

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    console.error(err)
    if (!res.headersSent) sendJson(res, 500, { error: errorMessage(err) })
  })
})

server.listen(SERVER_PORT, () => {
  console.log(`Server listening on http://localhost:${SERVER_PORT}`)
})
