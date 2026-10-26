import { describe, expect, it } from 'vitest'
import { buildCalendar, escapeText, eventSummary, foldLine, formatDate } from '../server/ics'
import { toMatches } from '../server/model'
import type { StoredMatch } from '../server/sync'
import { scheduleFixture } from './fixtures'

const now = new Date('2026-10-26T12:00:00Z')

const stored: StoredMatch[] = toMatches(scheduleFixture).map((m) => ({
  ...m,
  sequence: 2,
  firstSeenAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-25T12:00:00.000Z',
}))

const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('ics helpers', () => {
  it('escapes RFC 5545 text', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne')
  })

  it('formats dates in UTC basic format', () => {
    expect(formatDate(new Date('2026-11-14T19:00:00Z'))).toBe('20261114T190000Z')
  })

  it('folds lines at 75 octets without splitting characters', () => {
    const line = `SUMMARY:${'·'.repeat(100)}`
    const folded = foldLine(line)
    for (const part of folded.split('\r\n')) {
      expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })
})

describe('eventSummary', () => {
  it('includes the stage for placeholders', () => {
    const finals = stored.find((m) => m.id === '115660540726095133')!
    expect(eventSummary(finals)).toBe('Worlds Finals · TBD vs TBD (Bo5)')
  })

  it('shows team codes for real matches', () => {
    const match = stored.find((m) => m.id === '115660540726095041')!
    expect(eventSummary(match)).toBe('Worlds · LYON vs GEN (Bo3)')
  })
})

describe('buildCalendar', () => {
  const ics = buildCalendar(stored, new Map([['worlds', 'International']]), now)
  const text = unfold(ics)

  it('emits one event per match with CRLF line endings', () => {
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(stored.length)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/)
  })

  it('uses stable UIDs and carries the sequence', () => {
    expect(text).toContain('UID:lolesports-match-115660540726095133@lol-calendar')
    expect(text).toContain('SEQUENCE:2')
    expect(buildCalendar(stored, new Map(), now)).toContain('UID:lolesports-match-115660540726095133')
  })

  it('sets the duration from the best-of', () => {
    expect(text).toContain('DTSTART:20261114T190000Z\r\nDTEND:20261115T000000Z')
  })

  it('describes the league, region and result', () => {
    expect(text).toContain('DESCRIPTION:LYON vs Gen.G Esports\\nWorlds (International) — Swiss\\nBest of 3\\nFinal: LYON 1–2 GEN')
  })
})
