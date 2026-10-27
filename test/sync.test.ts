import { describe, expect, it } from 'vitest'
import type { Match } from '../lib/model'
import { mergeMatches, type StoredMatch } from '../lib/sync'

const now = new Date('2026-10-26T12:00:00Z')
const earlier = '2026-10-20T12:00:00.000Z'

const tbd = { name: 'TBD', code: 'TBD', image: '', gameWins: null, outcome: null }

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: '1',
  startTime: '2026-11-01T18:00:00Z',
  state: 'unstarted',
  leagueSlug: 'worlds',
  leagueName: 'Worlds',
  blockName: 'Semifinals',
  bestOf: 5,
  teams: [tbd, tbd],
  isPlaceholder: true,
  ...overrides,
})

const store = (match: Match): Record<string, StoredMatch> => ({
  [match.id]: { ...match, sequence: 0, firstSeenAt: earlier, updatedAt: earlier },
})

describe('mergeMatches', () => {
  it('adds unseen matches', () => {
    const match = makeMatch()
    const { matches, diff } = mergeMatches({}, [match], now)
    expect(diff.added).toEqual([match])
    expect(matches['1']).toMatchObject({ sequence: 0, firstSeenAt: now.toISOString() })
  })

  it('leaves unchanged matches untouched', () => {
    const stored = store(makeMatch())
    const { matches, diff } = mergeMatches(stored, [makeMatch()], now)
    expect(matches['1']).toEqual(stored['1'])
    expect(diff).toEqual({ added: [], filled: [], rescheduled: [], updated: 0 })
  })

  it('reports filled placeholders and bumps the sequence', () => {
    const real = makeMatch({
      isPlaceholder: false,
      teams: [
        { name: 'Gen.G Esports', code: 'GEN', image: '', gameWins: null, outcome: null },
        { name: 'T1', code: 'T1', image: '', gameWins: null, outcome: null },
      ],
    })
    const { matches, diff } = mergeMatches(store(makeMatch()), [real], now)
    expect(diff.filled).toEqual([real])
    expect(matches['1']).toMatchObject({ sequence: 1, firstSeenAt: earlier, updatedAt: now.toISOString() })
  })

  it('reports rescheduled matches', () => {
    const moved = makeMatch({ startTime: '2026-11-02T18:00:00Z' })
    const { diff } = mergeMatches(store(makeMatch()), [moved], now)
    expect(diff.rescheduled).toEqual([{ match: moved, previousStartTime: '2026-11-01T18:00:00Z' }])
  })

  it('counts other changes as updates', () => {
    const live = makeMatch({ state: 'inProgress' })
    const { diff } = mergeMatches(store(makeMatch()), [live], now)
    expect(diff.updated).toBe(1)
  })

  it('keeps stored matches missing from the fetch', () => {
    const stored = store(makeMatch({ startTime: '2026-09-01T18:00:00Z' }))
    const { matches } = mergeMatches(stored, [], now)
    expect(matches['1']).toEqual(stored['1'])
  })

  it('trims matches older than six months', () => {
    const stored = store(makeMatch({ startTime: '2026-03-01T18:00:00Z' }))
    expect(mergeMatches(stored, [], now).matches).toEqual({})
  })

  it('does not mutate the stored record', () => {
    const stored = store(makeMatch())
    const snapshot = structuredClone(stored)
    mergeMatches(stored, [makeMatch({ state: 'completed' })], now)
    expect(stored).toEqual(snapshot)
  })
})
