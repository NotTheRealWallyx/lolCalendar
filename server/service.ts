import { fetchLeagues, fetchSchedule } from './lolesports/client'
import { toLeagues, toMatches, type League } from './model'
import { loadMatchStore, loadSettings, saveMatchStore, saveSettings } from './store'
import { mergeMatches, type StoredMatch, type SyncDiff } from './sync'

const LEAGUES_TTL_MS = 6 * 60 * 60 * 1000
const SCHEDULE_TTL_MS = 5 * 60 * 1000

export type LeagueWithSetting = League & { enabled: boolean }

export type EnabledMatches = {
  matches: StoredMatch[]
  lastFetchedAt: string | null
  stale: boolean
}

let leaguesCache: { fetchedAt: number; leagues: League[] } | null = null
let lastRefresh: { fetchedAt: number; leagueKey: string } | null = null
let pendingRefresh: Promise<SyncDiff | null> | null = null

const getLeagues = async (): Promise<League[]> => {
  if (leaguesCache && Date.now() - leaguesCache.fetchedAt < LEAGUES_TTL_MS) {
    return leaguesCache.leagues
  }
  try {
    leaguesCache = { fetchedAt: Date.now(), leagues: toLeagues(await fetchLeagues()) }
  } catch (err) {
    if (!leaguesCache) throw err
    console.warn('Using cached leagues:', err)
  }
  return leaguesCache.leagues
}

export const listLeagues = async (): Promise<LeagueWithSetting[]> => {
  const [leagues, settings] = await Promise.all([getLeagues(), loadSettings()])
  const enabled = new Set(settings.enabledLeagues)
  return leagues.map((league) => ({ ...league, enabled: enabled.has(league.slug) }))
}

export const setLeagueEnabled = async (slug: string, enabled: boolean) => {
  const settings = await loadSettings()
  const others = settings.enabledLeagues.filter((s) => s !== slug)
  await saveSettings({ enabledLeagues: enabled ? [...others, slug] : others })
}

const runRefresh = async (force: boolean): Promise<SyncDiff | null> => {
  const leagues = await listLeagues()
  const leagueIds = leagues.filter((l) => l.enabled).map((l) => l.id)
  const leagueKey = [...leagueIds].sort().join(',')

  const isFresh =
    lastRefresh?.leagueKey === leagueKey && Date.now() - lastRefresh.fetchedAt < SCHEDULE_TTL_MS
  if (!force && isFresh) return null

  const fetched = toMatches(await fetchSchedule(leagueIds))
  const store = await loadMatchStore()
  const now = new Date()
  const { matches, diff } = mergeMatches(store.matches, fetched, now)
  await saveMatchStore({ lastFetchedAt: now.toISOString(), matches })
  lastRefresh = { fetchedAt: now.getTime(), leagueKey }
  return diff
}

// Returns null when the cached schedule was still fresh and nothing was fetched.
export const refreshMatches = async (force: boolean): Promise<SyncDiff | null> => {
  if (pendingRefresh && !force) return pendingRefresh
  // A forced sync must not reuse an in-flight lazy refresh, which may skip fetching.
  if (pendingRefresh) await pendingRefresh.catch(() => null)

  const refresh = runRefresh(force).finally(() => {
    if (pendingRefresh === refresh) pendingRefresh = null
  })
  pendingRefresh = refresh
  return refresh
}

export const getEnabledMatches = async (): Promise<EnabledMatches> => {
  let stale = false
  try {
    await refreshMatches(false)
  } catch (err) {
    console.warn('Schedule refresh failed, serving stored matches:', err)
    stale = true
  }

  const [store, settings] = await Promise.all([loadMatchStore(), loadSettings()])
  const enabled = new Set(settings.enabledLeagues)
  const matches = Object.values(store.matches)
    .filter((m) => enabled.has(m.leagueSlug))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  return { matches, lastFetchedAt: store.lastFetchedAt, stale }
}
