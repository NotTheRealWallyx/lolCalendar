import type { EnabledMatches, LeagueWithSetting } from '../server/service'
import type { SyncDiff } from '../server/sync'

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`)
  return body
}

export const getLeagues = () =>
  request<{ leagues: LeagueWithSetting[] }>('/api/leagues').then((b) => b.leagues)

export const setLeagueEnabled = (slug: string, enabled: boolean) =>
  request(`/api/leagues/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  })

export const getMatches = () => request<EnabledMatches>('/api/matches')

export const sync = () =>
  request<{ diff: SyncDiff | null }>('/api/sync', { method: 'POST' }).then((b) => b.diff)
