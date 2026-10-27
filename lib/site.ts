import { buildCalendar } from './ics'
import type { League } from './model'
import type { StoredMatch, SyncDiff } from './sync'

export type History = {
  generatedAt: string | null
  matches: Record<string, StoredMatch>
}

export type LeaguesFile = { generatedAt: string; leagues: League[] }
export type ChangesFile = { generatedAt: string; diff: SyncDiff }

export const HISTORY_PATH = 'data/matches.json'
export const LEAGUES_PATH = 'data/leagues.json'
export const CHANGES_PATH = 'data/changes.json'

export const feedPath = (slug: string) => `feeds/${slug}.ics`

const EMPTY_HISTORY: History = { generatedAt: null, matches: {} }

// Only a 404 (nothing published yet) may start from scratch: on any other failure we must not
// publish, or the history of finished matches would be lost from every feed.
export const loadPublishedHistory = async (
  siteUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<History> => {
  const url = new URL(HISTORY_PATH, siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)
  // Bypass the Pages CDN cache (~10 min) so back-to-back deploys build on the latest history.
  url.searchParams.set('t', String(Date.now()))
  const res = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (res.status === 404) return EMPTY_HISTORY
  if (!res.ok) throw new Error(`Could not load published history from ${url}: ${res.status}`)

  const body = (await res.json()) as Partial<History>
  if (typeof body.matches !== 'object' || body.matches === null) {
    throw new Error(`Published history at ${url} has no matches object`)
  }
  return { generatedAt: body.generatedAt ?? null, matches: body.matches }
}

export type BuildSiteFilesParams = {
  leagues: League[]
  matches: Record<string, StoredMatch>
  diff: SyncDiff
  now: Date
}

export const buildSiteFiles = (params: BuildSiteFilesParams): Map<string, string> => {
  const generatedAt = params.now.toISOString()
  const sorted = Object.values(params.matches).sort((a, b) => a.startTime.localeCompare(b.startTime))
  const regionBySlug = new Map(params.leagues.map((l) => [l.slug, l.regionCode]))
  const files = new Map<string, string>()

  for (const league of params.leagues) {
    files.set(
      feedPath(league.slug),
      buildCalendar({
        name: `LoL Esports · ${league.name} (${league.regionCode})`,
        description: `${league.name} matches from lolesports.com`,
        matches: sorted.filter((m) => m.leagueSlug === league.slug),
        regionBySlug,
        now: params.now,
      }),
    )
  }

  const history: History = { generatedAt, matches: params.matches }
  const leaguesFile: LeaguesFile = { generatedAt, leagues: params.leagues }
  const changesFile: ChangesFile = { generatedAt, diff: params.diff }
  files.set(HISTORY_PATH, JSON.stringify(history))
  files.set(LEAGUES_PATH, JSON.stringify(leaguesFile))
  files.set(CHANGES_PATH, JSON.stringify(changesFile))

  return files
}
