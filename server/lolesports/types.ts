export type ApiLeague = {
  id: string
  slug: string
  name: string
  region: string
  image: string
  priority: number
  displayPriority: {
    position: number
    status: 'force_selected' | 'selected' | 'not_selected' | 'hidden'
  }
}

export type ApiLeaguesResponse = {
  data: { leagues: ApiLeague[] }
}

export type ApiTeam = {
  name: string
  code: string
  image: string
  result: { outcome: 'win' | 'loss' | null; gameWins: number } | null
  record: { wins: number; losses: number } | null
}

export type ApiEventState = 'unstarted' | 'inProgress' | 'completed'

export type ApiEvent = {
  startTime: string
  state: ApiEventState
  type: string
  blockName: string
  league: { name: string; slug: string }
  match?: {
    id: string
    flags: string[]
    teams: ApiTeam[]
    strategy: { type: string; count: number }
  }
}

export type ApiScheduleResponse = {
  data: {
    schedule: {
      pages: { older: string | null; newer: string | null }
      events: ApiEvent[]
    }
  }
}
