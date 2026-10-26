import './style.css'
import type { LeagueWithSetting } from '../server/service'
import type { StoredMatch, SyncDiff } from '../server/sync'
import type { Match } from '../server/model'
import { FEED_PATH, SERVER_PORT } from '../shared/config'
import * as api from './api'

type Child = Node | string | null | false
type Attrs = Record<string, string | boolean | EventListener>

const h = (tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement => {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') el.addEventListener(key.slice(2), value)
    else if (value === true) el.setAttribute(key, '')
    else if (value !== false) el.setAttribute(key, value)
  }
  for (const child of children) if (child) el.append(child)
  return el
}

const state = {
  leagues: [] as LeagueWithSetting[],
  matches: [] as StoredMatch[],
  lastFetchedAt: null as string | null,
  stale: false,
  loading: true,
  syncing: false,
  syncResult: null as SyncDiff | null,
  error: null as string | null,
}

const feedUrl = `webcal://${location.hostname}:${SERVER_PORT}${FEED_PATH}`

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const regionByLeague = () => new Map(state.leagues.map((l) => [l.slug, l.regionCode]))

const loadMatches = async () => {
  const result = await api.getMatches()
  state.matches = result.matches
  state.lastFetchedAt = result.lastFetchedAt
  state.stale = result.stale
}

const run = async (task: () => Promise<void>) => {
  try {
    state.error = null
    await task()
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
  } finally {
    render()
  }
}

const toggleLeague = (league: LeagueWithSetting) =>
  run(async () => {
    league.enabled = !league.enabled
    render()
    try {
      await api.setLeagueEnabled(league.slug, league.enabled)
    } catch (err) {
      league.enabled = !league.enabled
      throw err
    }
    await loadMatches()
  })

const syncNow = () =>
  run(async () => {
    state.syncing = true
    state.syncResult = null
    render()
    try {
      state.syncResult = await api.sync()
      await loadMatches()
    } finally {
      state.syncing = false
    }
  })

const renderHeader = () =>
  h(
    'header',
    { class: 'header' },
    h(
      'div',
      {},
      h('h1', {}, 'LoL Calendar'),
      h('p', { class: 'muted' }, 'lolesports.com schedule, live in Apple Calendar'),
    ),
    h(
      'div',
      { class: 'actions' },
      h('a', { class: 'button primary', href: feedUrl }, 'Subscribe in Apple Calendar'),
      h('a', { class: 'button', href: `${FEED_PATH}?download=1` }, 'Download .ics'),
      h(
        'button',
        { class: 'button', onclick: () => void syncNow(), disabled: state.syncing },
        state.syncing ? 'Syncing…' : 'Sync now',
      ),
    ),
  )

const matchLabel = (match: Match) => {
  const [home, away] = match.teams
  return `${match.leagueName} · ${home.code} vs ${away.code}`
}

const renderDiffList = (title: string, items: string[]) =>
  items.length > 0 &&
  h(
    'div',
    { class: 'diff-group' },
    h('h3', {}, title),
    h('ul', {}, ...items.slice(0, 10).map((item) => h('li', {}, item))),
    items.length > 10 && h('p', { class: 'muted' }, `…and ${items.length - 10} more`),
  )

const renderSyncResult = (diff: SyncDiff) => {
  const total = diff.added.length + diff.filled.length + diff.rescheduled.length + diff.updated
  if (total === 0) return h('div', { class: 'notice' }, 'Already up to date.')

  const summary = [
    `${diff.added.length} new`,
    `${diff.filled.length} ${diff.filled.length === 1 ? 'placeholder' : 'placeholders'} filled`,
    `${diff.rescheduled.length} rescheduled`,
    `${diff.updated} updated`,
  ].join(' · ')

  return h(
    'div',
    { class: 'notice success' },
    h('strong', {}, summary),
    h('p', { class: 'muted' }, 'Apple Calendar picks this up on its next refresh. Press ⌘R in Calendar to pull it now.'),
    renderDiffList('Placeholders filled', diff.filled.map(matchLabel)),
    renderDiffList(
      'Rescheduled',
      diff.rescheduled.map(
        ({ match, previousStartTime }) =>
          `${matchLabel(match)}: ${dateTimeFormat.format(new Date(previousStartTime))} → ${dateTimeFormat.format(new Date(match.startTime))}`,
      ),
    ),
    renderDiffList('New matches', diff.added.map(matchLabel)),
  )
}

const renderStatus = () =>
  h(
    'section',
    { class: 'status' },
    state.error && h('div', { class: 'notice error' }, state.error),
    state.stale &&
      h('div', { class: 'notice warning' }, 'Could not reach lolesports.com. Showing the last synced schedule.'),
    state.syncResult && renderSyncResult(state.syncResult),
    state.lastFetchedAt &&
      h('p', { class: 'muted' }, `Last synced ${dateTimeFormat.format(new Date(state.lastFetchedAt))}`),
  )

const renderLeagues = () => {
  const groups = new Map<string, LeagueWithSetting[]>()
  for (const league of state.leagues) {
    groups.set(league.regionCode, [...(groups.get(league.regionCode) ?? []), league])
  }
  const regions = [...groups.keys()].sort((a, b) =>
    a === 'International' ? -1 : b === 'International' ? 1 : a.localeCompare(b),
  )
  const enabledCount = state.leagues.filter((l) => l.enabled).length

  return h(
    'aside',
    { class: 'panel leagues' },
    h('h2', {}, 'Leagues ', h('span', { class: 'muted' }, `${enabledCount} synced`)),
    ...regions.map((region) =>
      h(
        'div',
        { class: 'region' },
        h('h3', {}, region),
        ...(groups.get(region) ?? []).map((league) =>
          h(
            'label',
            { class: 'toggle' },
            h('input', {
              type: 'checkbox',
              checked: league.enabled,
              onchange: () => void toggleLeague(league),
            }),
            h('span', { class: 'switch', 'aria-hidden': 'true' }),
            h('span', { class: 'league-name' }, league.name),
            h('span', { class: 'region-tag' }, league.regionCode),
          ),
        ),
      ),
    ),
  )
}

const renderTeams = (match: StoredMatch) => {
  const [home, away] = match.teams
  if (match.state === 'completed') {
    return h(
      'span',
      { class: 'teams' },
      h('span', { class: home.outcome === 'win' ? 'winner' : '' }, home.code),
      h('span', { class: 'score' }, ` ${home.gameWins ?? 0}–${away.gameWins ?? 0} `),
      h('span', { class: away.outcome === 'win' ? 'winner' : '' }, away.code),
    )
  }
  return h('span', { class: 'teams' }, `${home.code} vs ${away.code}`)
}

const renderMatch = (match: StoredMatch, regions: Map<string, string>) =>
  h(
    'li',
    { class: 'match' },
    h('time', { class: 'time' }, timeFormat.format(new Date(match.startTime))),
    h(
      'div',
      { class: 'match-main' },
      renderTeams(match),
      h(
        'span',
        { class: 'muted' },
        [match.leagueName, regions.get(match.leagueSlug), match.blockName, match.bestOf && `Bo${match.bestOf}`]
          .filter(Boolean)
          .join(' · '),
      ),
    ),
    h(
      'div',
      { class: 'badges' },
      match.isPlaceholder && h('span', { class: 'badge placeholder' }, 'Placeholder'),
      match.state === 'inProgress' && h('span', { class: 'badge live' }, 'Live'),
    ),
  )

const renderMatches = () => {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const upcoming = state.matches.filter((m) => new Date(m.startTime) >= startOfToday)
  const regions = regionByLeague()

  const days = new Map<string, StoredMatch[]>()
  for (const match of upcoming) {
    const day = dayFormat.format(new Date(match.startTime))
    days.set(day, [...(days.get(day) ?? []), match])
  }
  const placeholders = upcoming.filter((m) => m.isPlaceholder).length

  return h(
    'section',
    { class: 'panel matches' },
    h(
      'h2',
      {},
      'Upcoming ',
      h('span', { class: 'muted' }, `${upcoming.length} matches · ${placeholders} placeholders`),
    ),
    state.loading && h('p', { class: 'muted' }, 'Loading schedule…'),
    !state.loading &&
      upcoming.length === 0 &&
      h('p', { class: 'muted' }, 'No upcoming matches for the selected leagues.'),
    ...[...days].map(([day, matches]) =>
      h(
        'div',
        { class: 'day' },
        h('h3', {}, day),
        h('ul', {}, ...matches.map((m) => renderMatch(m, regions))),
      ),
    ),
  )
}

const root = document.querySelector<HTMLDivElement>('#app')

const render = () => {
  root?.replaceChildren(
    renderHeader(),
    renderStatus(),
    h('div', { class: 'layout' }, renderLeagues(), renderMatches()),
  )
}

render()
void run(async () => {
  try {
    state.leagues = await api.getLeagues()
    await loadMatches()
  } finally {
    state.loading = false
  }
})
