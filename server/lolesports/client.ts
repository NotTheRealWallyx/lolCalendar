import { LOLESPORTS_API_KEY, LOLESPORTS_API_URL, LOLESPORTS_LOCALE } from '../config'
import type { ApiEvent, ApiLeague, ApiLeaguesResponse, ApiScheduleResponse } from './types'

const REQUEST_TIMEOUT_MS = 10_000
const MAX_NEWER_PAGES = 10

const apiGet = async <T>(path: string, query: Record<string, string> = {}): Promise<T> => {
  const url = new URL(`${LOLESPORTS_API_URL}/${path}`)
  url.searchParams.set('hl', LOLESPORTS_LOCALE)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)

  const res = await fetch(url, {
    headers: { 'x-api-key': LOLESPORTS_API_KEY },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`lolesports ${path} failed: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export const fetchLeagues = async (): Promise<ApiLeague[]> => {
  const body = await apiGet<ApiLeaguesResponse>('getLeagues')
  return body.data.leagues
}

// The first page is centred on "now" and already includes a few weeks of past matches.
export const fetchSchedule = async (leagueIds: string[]): Promise<ApiEvent[]> => {
  if (leagueIds.length === 0) return []

  const leagueId = leagueIds.join(',')
  const first = await apiGet<ApiScheduleResponse>('getSchedule', { leagueId })
  const events = [...first.data.schedule.events]

  let newer = first.data.schedule.pages.newer
  for (let page = 0; newer && page < MAX_NEWER_PAGES; page++) {
    const next = await apiGet<ApiScheduleResponse>('getSchedule', { leagueId, pageToken: newer })
    events.push(...next.data.schedule.events)
    newer = next.data.schedule.pages.newer
  }

  return events
}
