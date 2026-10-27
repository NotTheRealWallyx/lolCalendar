import { describe, expect, it } from 'vitest'
import { regionCode } from '../lib/lolesports/regions'
import { toLeagues, toMatches } from '../lib/model'
import { leaguesFixture, scheduleFixture } from './fixtures'

describe('toLeagues', () => {
  const leagues = toLeagues(leaguesFixture)
  const bySlug = new Map(leagues.map((l) => [l.slug, l]))

  it('maps regions to short codes', () => {
    expect(bySlug.get('lcs')?.regionCode).toBe('NA')
    expect(bySlug.get('lck')?.regionCode).toBe('KR')
    expect(bySlug.get('lpl')?.regionCode).toBe('CN')
    expect(bySlug.get('lec')?.regionCode).toBe('EMEA')
    expect(bySlug.get('worlds')?.regionCode).toBe('International')
  })

  it('serves league logos over https', () => {
    expect(bySlug.get('worlds')?.image).toBe(
      'https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png',
    )
  })

  it('drops hidden and non-LoL leagues', () => {
    expect(bySlug.has('lta_n')).toBe(false)
    expect(bySlug.has('tft_esports')).toBe(false)
  })
})

describe('regionCode', () => {
  it('falls back to a title-cased region name', () => {
    expect(regionCode('MIDDLE EARTH')).toBe('Middle Earth')
  })
})

describe('toMatches', () => {
  const matches = toMatches(scheduleFixture)

  it('keeps every match event, sorted by start time', () => {
    expect(matches).toHaveLength(80)
    const starts = matches.map((m) => m.startTime)
    expect(starts).toEqual([...starts].sort())
  })

  it('flags TBD placeholders', () => {
    const finals = matches.find((m) => m.id === '115660540726095133')
    expect(finals).toMatchObject({ isPlaceholder: true, bestOf: 5, blockName: 'Finals' })
    expect(matches.filter((m) => m.isPlaceholder)).toHaveLength(18)
  })

  it('keeps results of completed matches', () => {
    const match = matches.find((m) => m.id === '115660540726095041')
    expect(match).toMatchObject({ state: 'completed', isPlaceholder: false, bestOf: 3 })
    expect(match?.teams.map((t) => [t.code, t.gameWins, t.outcome])).toEqual([
      ['LYON', 1, 'loss'],
      ['GEN', 2, 'win'],
    ])
  })

  it('serves team logos over https', () => {
    const match = matches.find((m) => m.id === '115660540726095041')
    expect(match?.teams[0].image).toBe(
      'https://static.lolesports.com/teams/1743717443673_isotypelyon-03.png',
    )
  })

  it('skips events without a match', () => {
    const show = { ...scheduleFixture[0]!, type: 'show', match: undefined }
    expect(toMatches([show])).toEqual([])
  })
})
