import { leagueUrl, matchUrl, vodUrl } from './links'
import type { Team } from './model'
import type { StoredMatch } from './sync'

const CRLF = '\r\n'
const MAX_LINE_BYTES = 75
const HOUR_MS = 60 * 60 * 1000

export const escapeText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

export const formatDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// RFC 5545 §3.1: lines are limited to 75 octets; continuations start with a space.
export const foldLine = (line: string): string => {
  const parts: string[] = []
  let current = ''
  let currentBytes = 0

  for (const char of line) {
    const charBytes = Buffer.byteLength(char)
    const limit = parts.length === 0 ? MAX_LINE_BYTES : MAX_LINE_BYTES - 1
    if (currentBytes + charBytes > limit) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += char
    currentBytes += charBytes
  }
  parts.push(current)

  return parts.join(`${CRLF} `)
}

const bestOfLabel = (match: StoredMatch) => (match.bestOf ? ` (Bo${match.bestOf})` : '')

export const eventSummary = (match: StoredMatch) => {
  const [home, away] = match.teams
  const title = match.isPlaceholder && match.blockName
    ? `${match.leagueName} ${match.blockName}`
    : match.leagueName
  return `${title} · ${home.code} vs ${away.code}${bestOfLabel(match)}`
}

const stateLine = (match: StoredMatch) => {
  const [home, away] = match.teams
  if (match.state === 'inProgress') return 'Live now'
  if (match.state === 'completed') {
    const score = (team: Team) => team.gameWins ?? 0
    return `Final: ${home.code} ${score(home)}–${score(away)} ${away.code}`
  }
  return 'Upcoming'
}

const eventDescription = (match: StoredMatch, regionCode: string | undefined) => {
  const [home, away] = match.teams
  const league = regionCode ? `${match.leagueName} (${regionCode})` : match.leagueName
  const vod = vodUrl(match)
  return [
    `${home.name} vs ${away.name}`,
    match.blockName ? `${league} — ${match.blockName}` : league,
    match.bestOf ? `Best of ${match.bestOf}` : null,
    stateLine(match),
    match.isPlaceholder
      ? 'Teams to be decided. This event updates automatically once they are known.'
      : null,
    vod ? `Watch the VOD: ${vod}` : `Schedule: ${leagueUrl(match.leagueSlug)}`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

const buildEvent = (match: StoredMatch, regionCode: string | undefined, now: Date) => {
  const start = new Date(match.startTime)
  const end = new Date(start.getTime() + (match.bestOf ?? 1) * HOUR_MS)

  return [
    'BEGIN:VEVENT',
    `UID:lolesports-match-${match.id}@lol-calendar`,
    `DTSTAMP:${formatDate(now)}`,
    `CREATED:${formatDate(new Date(match.firstSeenAt))}`,
    `LAST-MODIFIED:${formatDate(new Date(match.updatedAt))}`,
    `SEQUENCE:${match.sequence}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${escapeText(eventSummary(match))}`,
    `DESCRIPTION:${escapeText(eventDescription(match, regionCode))}`,
    `CATEGORIES:${escapeText(match.leagueName)}`,
    `URL:${matchUrl(match)}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ]
}

export type BuildCalendarParams = {
  name: string
  description: string
  matches: StoredMatch[]
  regionBySlug: Map<string, string>
  now: Date
}

export const buildCalendar = (params: BuildCalendarParams): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//lol-calendar//lolesports schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(params.name)}`,
    `X-WR-CALDESC:${escapeText(params.description)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...params.matches.flatMap((match) =>
      buildEvent(match, params.regionBySlug.get(match.leagueSlug), params.now),
    ),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join(CRLF) + CRLF
}
