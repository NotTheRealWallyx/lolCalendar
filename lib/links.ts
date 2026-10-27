import type { Match } from './model'

const LOLESPORTS_SITE = 'https://lolesports.com'

export const leagueUrl = (slug: string) => `${LOLESPORTS_SITE}/en-GB/leagues/${slug}`

export const vodUrl = (match: Match): string | null =>
  match.state === 'completed' && match.hasVod ? `${LOLESPORTS_SITE}/vod/${match.id}/1` : null

// lolesports.com has no page per upcoming match, so those link to the league's schedule.
export const matchUrl = (match: Match) => vodUrl(match) ?? leagueUrl(match.leagueSlug)
