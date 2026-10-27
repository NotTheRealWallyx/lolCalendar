import type { z } from 'zod'
import { LOLESPORTS_API_KEY, LOLESPORTS_API_URL, LOLESPORTS_LOCALE } from '../config'
import {
  ApiLeaguesResponseSchema,
  ApiScheduleResponseSchema,
  type ApiEvent,
  type ApiLeague,
} from './types'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_NEWER_PAGES = 10
const MAX_REPORTED_ISSUES = 5

export const parseResponse = <S extends z.ZodType>(path: string, schema: S, body: unknown): z.infer<S> => {
  const result = schema.safeParse(body)
  if (result.success) return result.data

  const issues = result.error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  throw new Error(`lolesports ${path} returned an unexpected response:\n  ${issues.join('\n  ')}`)
}

const apiGet = async <S extends z.ZodType>(
  path: string,
  schema: S,
  query: Record<string, string> = {},
): Promise<z.infer<S>> => {
  const url = new URL(`${LOLESPORTS_API_URL}/${path}`)
  url.searchParams.set('hl', LOLESPORTS_LOCALE)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)

  const res = await fetch(url, {
    headers: { 'x-api-key': LOLESPORTS_API_KEY },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`lolesports ${path} failed: ${res.status} ${res.statusText}`)
  return parseResponse(path, schema, await res.json())
}

export const fetchLeagues = async (): Promise<ApiLeague[]> => {
  const body = await apiGet('getLeagues', ApiLeaguesResponseSchema)
  return body.data.leagues
}

// The first page is centred on "now" and already includes a few weeks of past matches.
export const fetchSchedule = async (leagueIds: string[]): Promise<ApiEvent[]> => {
  if (leagueIds.length === 0) return []

  const leagueId = leagueIds.join(',')
  const first = await apiGet('getSchedule', ApiScheduleResponseSchema, { leagueId })
  const events = [...first.data.schedule.events]

  let newer = first.data.schedule.pages.newer
  for (let page = 0; newer && page < MAX_NEWER_PAGES; page++) {
    const next = await apiGet('getSchedule', ApiScheduleResponseSchema, { leagueId, pageToken: newer })
    events.push(...next.data.schedule.events)
    newer = next.data.schedule.pages.newer
  }

  return events
}
