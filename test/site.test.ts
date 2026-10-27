import { describe, expect, it } from 'vitest'
import { toLeagues, toMatches } from '../lib/model'
import {
  buildSiteFiles,
  CHANGES_PATH,
  feedPath,
  HISTORY_PATH,
  LEAGUES_PATH,
  loadPublishedHistory,
  type ChangesFile,
  type History,
  type LeaguesFile,
} from '../lib/site'
import { mergeMatches } from '../lib/sync'
import { leaguesFixture, scheduleFixture } from './fixtures'

const now = new Date('2026-10-26T12:00:00Z')

const fakeFetch =
  (status: number, body: unknown = {}): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))

describe('loadPublishedHistory', () => {
  it('starts empty when nothing is published yet', async () => {
    const history = await loadPublishedHistory('https://example.test/site', fakeFetch(404))
    expect(history).toEqual({ generatedAt: null, matches: {} })
  })

  it('fails on other errors so a deploy cannot drop history', async () => {
    await expect(loadPublishedHistory('https://example.test/', fakeFetch(500))).rejects.toThrow(
      /500/,
    )
  })

  it('fails on a malformed history file', async () => {
    await expect(
      loadPublishedHistory('https://example.test/', fakeFetch(200, { nope: true })),
    ).rejects.toThrow(/no matches/)
  })

  it('reads the history next to the site', async () => {
    const published: History = { generatedAt: now.toISOString(), matches: {} }
    let requested = ''
    const fetchImpl: typeof fetch = (input) => {
      requested = (input as URL).href
      return Promise.resolve(new Response(JSON.stringify(published)))
    }
    expect(await loadPublishedHistory('https://example.test/lolCalendar', fetchImpl)).toEqual(
      published,
    )
    expect(requested).toMatch(/^https:\/\/example\.test\/lolCalendar\/data\/matches\.json\?t=\d+$/)
  })
})

describe('buildSiteFiles', () => {
  const leagues = toLeagues(leaguesFixture)
  const { matches, diff } = mergeMatches({}, toMatches(scheduleFixture), now)
  const files = buildSiteFiles({ leagues, matches, diff, now })

  it('writes one feed per league, named after it', () => {
    for (const league of leagues) expect(files.has(feedPath(league.slug))).toBe(true)
    expect(files.get(feedPath('worlds'))).toContain(
      'X-WR-CALNAME:LoL Esports · Worlds (International)',
    )
  })

  it('only puts the league’s own matches in its feed', () => {
    expect(files.get(feedPath('worlds'))?.match(/BEGIN:VEVENT/g)).toHaveLength(46)
    expect(files.get(feedPath('emea_masters'))?.match(/BEGIN:VEVENT/g)).toHaveLength(11)
    expect(files.get(feedPath('lec'))).not.toContain('BEGIN:VEVENT')
  })

  it('writes history that loads back unchanged', async () => {
    const fetchImpl: typeof fetch = () => Promise.resolve(new Response(files.get(HISTORY_PATH)))
    const history = await loadPublishedHistory('https://example.test/', fetchImpl)
    expect(history).toEqual({ generatedAt: now.toISOString(), matches })
  })

  it('writes leagues and the last run’s changes for the page', () => {
    const leaguesFile = JSON.parse(files.get(LEAGUES_PATH)!) as LeaguesFile
    const changesFile = JSON.parse(files.get(CHANGES_PATH)!) as ChangesFile
    expect(leaguesFile.leagues).toEqual(leagues)
    expect(changesFile.diff.added).toHaveLength(80)
  })
})
