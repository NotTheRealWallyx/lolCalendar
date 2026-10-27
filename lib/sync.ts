import type { Match } from './model'

export type StoredMatch = Match & {
  sequence: number
  firstSeenAt: string
  updatedAt: string
}

export type SyncDiff = {
  added: Match[]
  filled: Match[]
  rescheduled: { match: Match; previousStartTime: string }[]
  updated: number
}

const RETENTION_MS = 183 * 24 * 60 * 60 * 1000

const toMatch = ({ sequence: _s, firstSeenAt: _f, updatedAt: _u, ...match }: StoredMatch): Match =>
  match

const contentKey = (match: Match) =>
  JSON.stringify([
    match.startTime,
    match.state,
    match.leagueName,
    match.blockName,
    match.bestOf,
    match.teams,
    match.isPlaceholder,
    // History written before VOD links existed has no hasVod field; treat it as false.
    match.hasVod === true,
  ])

export const mergeMatches = (
  stored: Record<string, StoredMatch>,
  fetched: Match[],
  now: Date,
): { matches: Record<string, StoredMatch>; diff: SyncDiff } => {
  const nowIso = now.toISOString()
  const matches: Record<string, StoredMatch> = { ...stored }
  const diff: SyncDiff = { added: [], filled: [], rescheduled: [], updated: 0 }

  for (const match of fetched) {
    const previous = stored[match.id]

    if (!previous) {
      matches[match.id] = { ...match, sequence: 0, firstSeenAt: nowIso, updatedAt: nowIso }
      diff.added.push(match)
      continue
    }

    if (contentKey(toMatch(previous)) === contentKey(match)) continue

    matches[match.id] = {
      ...match,
      sequence: previous.sequence + 1,
      firstSeenAt: previous.firstSeenAt,
      updatedAt: nowIso,
    }

    if (previous.isPlaceholder && !match.isPlaceholder) {
      diff.filled.push(match)
    } else if (previous.startTime !== match.startTime) {
      diff.rescheduled.push({ match, previousStartTime: previous.startTime })
    } else {
      diff.updated++
    }
  }

  const cutoff = now.getTime() - RETENTION_MS
  for (const [id, match] of Object.entries(matches)) {
    if (Date.parse(match.startTime) < cutoff) delete matches[id]
  }

  return { matches, diff }
}
