import { regionCode } from './lolesports/regions'
import type { ApiEvent, ApiEventState, ApiLeague, ApiTeam } from './lolesports/types'

export type League = {
  id: string
  slug: string
  name: string
  region: string
  regionCode: string
  image: string
}

export type Team = {
  name: string
  code: string
  image: string
  gameWins: number | null
  outcome: 'win' | 'loss' | null
}

export type Match = {
  id: string
  startTime: string
  state: ApiEventState
  leagueSlug: string
  leagueName: string
  blockName: string
  bestOf: number | null
  teams: [Team, Team]
  isPlaceholder: boolean
  hasVod: boolean
}

const HIDDEN_LEAGUE_SLUGS = new Set(['tft_esports'])

// The API mixes http:// and https:// image URLs; http ones are blocked as mixed content on https pages.
export const toHttps = (url: string) => url.replace(/^http:\/\//, 'https://')

export const toLeagues = (apiLeagues: ApiLeague[]): League[] =>
  apiLeagues
    .filter((l) => l.displayPriority.status !== 'hidden' && !HIDDEN_LEAGUE_SLUGS.has(l.slug))
    .map((l) => ({
      id: l.id,
      slug: l.slug,
      name: l.name,
      region: l.region,
      regionCode: regionCode(l.region),
      image: toHttps(l.image),
    }))

const isTbd = (team: ApiTeam) => team.code === 'TBD' || team.name === 'TBD'

const toTeam = (team: ApiTeam): Team => ({
  name: team.name,
  code: team.code,
  image: toHttps(team.image),
  gameWins: team.result?.gameWins ?? null,
  outcome: team.result?.outcome ?? null,
})

export const toMatches = (events: ApiEvent[]): Match[] => {
  const matches = new Map<string, Match>()

  for (const event of events) {
    const [home, away] = event.match?.teams ?? []
    if (event.type !== 'match' || !event.match || !home || !away) continue

    matches.set(event.match.id, {
      id: event.match.id,
      startTime: event.startTime,
      state: event.state,
      leagueSlug: event.league.slug,
      leagueName: event.league.name,
      blockName: event.blockName,
      bestOf: event.match.strategy.type === 'bestOf' ? event.match.strategy.count : null,
      teams: [toTeam(home), toTeam(away)],
      isPlaceholder: isTbd(home) || isTbd(away),
      hasVod: event.match.flags.includes('hasVod'),
    })
  }

  return [...matches.values()].sort((a, b) => a.startTime.localeCompare(b.startTime))
}
