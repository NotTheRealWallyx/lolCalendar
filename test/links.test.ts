import { describe, expect, it } from 'vitest'
import { leagueUrl, matchUrl, vodUrl } from '../lib/links'
import type { Match } from '../lib/model'

const team = { name: 'G2 Esports', code: 'G2', image: '', gameWins: null, outcome: null }

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: '42',
  startTime: '2026-11-01T18:00:00Z',
  state: 'completed',
  leagueSlug: 'lec',
  leagueName: 'LEC',
  blockName: 'Finals',
  bestOf: 5,
  teams: [team, team],
  isPlaceholder: false,
  hasVod: true,
  ...overrides,
})

describe('links', () => {
  it('links finished matches with a VOD to it', () => {
    expect(vodUrl(makeMatch())).toBe('https://lolesports.com/vod/42/1')
    expect(matchUrl(makeMatch())).toBe('https://lolesports.com/vod/42/1')
  })

  it('falls back to the league page without a VOD', () => {
    expect(vodUrl(makeMatch({ hasVod: false }))).toBeNull()
    expect(matchUrl(makeMatch({ state: 'unstarted', hasVod: false }))).toBe(leagueUrl('lec'))
    expect(leagueUrl('lec')).toBe('https://lolesports.com/en-GB/leagues/lec')
  })

  it('only offers a VOD once the match is over', () => {
    expect(vodUrl(makeMatch({ state: 'inProgress' }))).toBeNull()
  })
})
