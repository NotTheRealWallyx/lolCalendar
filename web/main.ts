import './style.css'
import { leagueUrl, vodUrl } from '../lib/links'
import type { League, Match, Team } from '../lib/model'
import {
  CHANGES_PATH,
  feedPath,
  HISTORY_PATH,
  LEAGUES_PATH,
  type ChangesFile,
  type History,
  type LeaguesFile,
} from '../lib/site'
import type { StoredMatch, SyncDiff } from '../lib/sync'

type Child = Node | string | null | false | undefined
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

const HIDDEN_STORAGE_KEY = 'lol-calendar:hidden-leagues'
const SECTIONS_STORAGE_KEY = 'lol-calendar:sections'
const LEAGUES_PANEL = 'leagues'
const STALE_AFTER_MS = 3 * 60 * 60 * 1000

const readStored = <T>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as T) : fallback
  } catch {
    return fallback
  }
}

const writeStored = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable (private mode); preferences then last for this visit only.
  }
}

const state = {
  leagues: [] as League[],
  matches: [] as StoredMatch[],
  changes: null as SyncDiff | null,
  generatedAt: null as string | null,
  hidden: new Set(readStored<string[]>(HIDDEN_STORAGE_KEY, [])),
  sections: readStored<Record<string, boolean>>(SECTIONS_STORAGE_KEY, {}),
  copied: null as string | null,
  loading: true,
  error: null as string | null,
}

const getJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(path, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`)
  return (await res.json()) as T
}

const feedUrls = (slug: string) => {
  const https = new URL(feedPath(slug), location.href).href
  return { https, webcal: https.replace(/^https?:/, 'webcal:') }
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const shortFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return relativeFormat.format(hours, 'hour')
  return relativeFormat.format(Math.round(hours / 24), 'day')
}

const startOfToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const upcomingMatches = () => {
  const from = startOfToday().getTime()
  return state.matches.filter((m) => Date.parse(m.startTime) >= from)
}

const logo = (src: string, className: string) =>
  src
    ? h('img', {
        class: className,
        src,
        alt: '',
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
        onerror: (event: Event) => (event.target as HTMLElement).classList.add('broken'),
      })
    : h('span', { class: `${className} broken` })

const copyLink = async (slug: string) => {
  await navigator.clipboard.writeText(feedUrls(slug).https)
  state.copied = slug
  render()
  setTimeout(() => {
    if (state.copied === slug) {
      state.copied = null
      render()
    }
  }, 2000)
}

const setShown = (slug: string | null, shown: boolean) => {
  if (slug === null) state.hidden.clear()
  else if (shown) state.hidden.delete(slug)
  else state.hidden.add(slug)
  writeStored(HIDDEN_STORAGE_KEY, [...state.hidden])
  render()
}

// Rendering replaces the whole DOM, so <details> elements get their open state from here.
const collapsible = (params: {
  id: string
  defaultOpen: boolean
  className: string
  summary: Child[]
  body: Child[]
}) =>
  h(
    'details',
    {
      class: params.className,
      open: state.sections[params.id] ?? params.defaultOpen,
      ontoggle: (event: Event) => {
        const open = (event.target as HTMLDetailsElement).open
        // Creating an open <details> also fires "toggle"; don't freeze defaults into storage.
        if (state.sections[params.id] === undefined && open === params.defaultOpen) return
        state.sections[params.id] = open
        writeStored(SECTIONS_STORAGE_KEY, state.sections)
      },
    },
    h('summary', {}, ...params.summary, h('span', { class: 'chevron', 'aria-hidden': 'true' })),
    ...params.body,
  )

const matchup = (match: Match) => `${match.teams[0].code} vs ${match.teams[1].code}`

const renderTopBar = () =>
  h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'brand' },
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
      h('span', {}, 'LoL Esports Calendar'),
    ),
    state.generatedAt &&
      h(
        'span',
        { class: 'updated', title: new Date(state.generatedAt).toLocaleString() },
        h('span', { class: 'pulse', 'aria-hidden': 'true' }),
        `Updated ${relativeTime(state.generatedAt)}`,
      ),
  )

const renderHero = () =>
  h(
    'section',
    { class: 'hero' },
    h('h1', {}, 'Every LoL esports match, in your calendar'),
    h(
      'p',
      { class: 'lead' },
      'Subscribe to the leagues you follow. Placeholder matches fill in with the real teams as soon as they are decided. Updated hourly from lolesports.com.',
    ),
  )

const renderSteps = () =>
  h(
    'ol',
    { class: 'steps' },
    h('li', {}, h('strong', {}, 'Pick a league'), ' and press Subscribe.'),
    h('li', {}, h('strong', {}, 'Confirm'), ' in Apple Calendar (or paste the copied link into Google Calendar → From URL).'),
    h('li', {}, h('strong', {}, 'Done.'), ' Each league is its own calendar, so you can colour or hide it.'),
  )

const renderNotices = () => {
  const notices: Child[] = []
  if (state.error) notices.push(h('div', { class: 'notice error' }, state.error))
  if (state.generatedAt && Date.now() - Date.parse(state.generatedAt) > STALE_AFTER_MS) {
    notices.push(
      h('div', { class: 'notice warning' }, `The schedule has not refreshed since ${relativeTime(state.generatedAt)}. Feeds still serve the last known schedule.`),
    )
  }

  const diff = state.changes
  if (diff) {
    const parts = [
      diff.added.length && `${diff.added.length} new`,
      diff.filled.length && `${diff.filled.length} ${diff.filled.length === 1 ? 'placeholder' : 'placeholders'} filled`,
      diff.rescheduled.length && `${diff.rescheduled.length} rescheduled`,
      diff.updated && `${diff.updated} updated`,
    ].filter(Boolean)
    if (parts.length > 0) {
      notices.push(
        h(
          'div',
          { class: 'notice' },
          h('strong', {}, 'Last update: '),
          parts.join(' · '),
          diff.filled.length > 0 &&
            h('span', { class: 'muted' }, ` — ${diff.filled.slice(0, 4).map((m) => `${m.leagueName} ${matchup(m)}`).join(', ')}${diff.filled.length > 4 ? '…' : ''}`),
        ),
      )
    }
  }
  return notices.length > 0 ? h('section', { class: 'notices' }, ...notices) : null
}

const regionOrder = (a: string, b: string) =>
  a === 'International' ? -1 : b === 'International' ? 1 : a.localeCompare(b)

const renderLeagueCard = (league: League, next: StoredMatch | undefined, upcomingCount: number) => {
  const urls = feedUrls(league.slug)
  const shown = !state.hidden.has(league.slug)
  return h(
    'article',
    { class: `league-card${upcomingCount === 0 ? ' quiet' : ''}` },
    h(
      'div',
      { class: 'league-head' },
      h('div', { class: 'league-logo-tile' }, logo(league.image, 'league-logo')),
      h(
        'div',
        { class: 'league-title' },
        h('h3', {}, league.name),
        h('span', { class: 'chip' }, league.regionCode),
      ),
    ),
    h(
      'p',
      { class: 'league-next' },
      ...(next
        ? ['Next: ', h('strong', {}, matchup(next)), ` · ${shortFormat.format(new Date(next.startTime))}`]
        : ['No upcoming matches']),
    ),
    h(
      'div',
      { class: 'league-actions' },
      h('a', { class: 'button primary', href: urls.webcal }, 'Subscribe'),
      h(
        'button',
        {
          class: 'button',
          type: 'button',
          title: urls.https,
          onclick: () => void copyLink(league.slug).catch(() => window.prompt('Copy this link:', urls.https)),
        },
        state.copied === league.slug ? 'Copied ✓' : 'Copy link',
      ),
    ),
    h(
      'label',
      { class: 'toggle' },
      h('input', {
        id: `show-${league.slug}`,
        type: 'checkbox',
        checked: shown,
        onchange: () => setShown(league.slug, !shown),
      }),
      h('span', { class: 'switch', 'aria-hidden': 'true' }),
      'Show in schedule',
    ),
  )
}

const renderLeagues = () => {
  const upcoming = upcomingMatches()
  const nextBySlug = new Map<string, StoredMatch>()
  const countBySlug = new Map<string, number>()
  for (const match of upcoming) {
    if (!nextBySlug.has(match.leagueSlug)) nextBySlug.set(match.leagueSlug, match)
    countBySlug.set(match.leagueSlug, (countBySlug.get(match.leagueSlug) ?? 0) + 1)
  }

  const groups = new Map<string, League[]>()
  for (const league of state.leagues) {
    groups.set(league.regionCode, [...(groups.get(league.regionCode) ?? []), league])
  }

  const active = [...countBySlug.keys()]
  const shownActive = active.filter((slug) => !state.hidden.has(slug)).length

  const regions = [...groups.keys()].sort(regionOrder).map((region) => {
    const leagues = [...(groups.get(region) ?? [])].sort(
      (a, b) => Number(countBySlug.has(b.slug)) - Number(countBySlug.has(a.slug)),
    )
    const withMatches = leagues.filter((l) => countBySlug.has(l.slug)).length
    return collapsible({
      id: `region:${region}`,
      defaultOpen: withMatches > 0,
      className: 'region',
      summary: [
        h('span', { class: 'region-name' }, region),
        h(
          'span',
          { class: 'muted' },
          `${leagues.length} ${leagues.length === 1 ? 'league' : 'leagues'}${withMatches > 0 ? ` · ${withMatches} with matches` : ''}`,
        ),
      ],
      body: [
        h(
          'div',
          { class: 'league-grid' },
          ...leagues.map((l) => renderLeagueCard(l, nextBySlug.get(l.slug), countBySlug.get(l.slug) ?? 0)),
        ),
      ],
    })
  })

  return h(
    'section',
    { class: 'section', id: 'leagues' },
    collapsible({
      id: LEAGUES_PANEL,
      defaultOpen: false,
      className: 'leagues-panel',
      summary: [
        h(
          'span',
          { class: 'panel-title' },
          h('h2', {}, 'Subscribe to leagues'),
          !state.loading &&
            h(
              'span',
              { class: 'muted' },
              `${state.leagues.length} leagues, one calendar each · ${shownActive} of ${active.length} active ${active.length === 1 ? 'league' : 'leagues'} shown in the schedule`,
            ),
        ),
      ],
      body: [h('div', { class: 'panel-body' }, renderSteps(), ...regions)],
    }),
  )
}

const renderTeam = (team: Team, side: 'home' | 'away', match: StoredMatch) =>
  h(
    'span',
    { class: `team ${side}${match.state === 'completed' && team.outcome === 'win' ? ' winner' : ''}`, title: team.name },
    logo(team.image, 'team-logo'),
    h('span', { class: 'team-code' }, team.code),
  )

const externalLink = (href: string) => ({ href, target: '_blank', rel: 'noopener noreferrer' })

const renderMatch = (match: StoredMatch, leagueBySlug: Map<string, League>) => {
  const [home, away] = match.teams
  const league = leagueBySlug.get(match.leagueSlug)
  const vod = vodUrl(match)
  const center =
    match.state === 'completed'
      ? h('span', { class: 'score' }, `${home.gameWins ?? 0} – ${away.gameWins ?? 0}`)
      : h('span', { class: 'versus' }, 'vs')

  return h(
    'li',
    { class: `match${match.state === 'completed' ? ' done' : ''}` },
    h('time', { class: 'match-time', datetime: match.startTime }, timeFormat.format(new Date(match.startTime))),
    h(
      'div',
      { class: 'match-teams' },
      renderTeam(home, 'home', match),
      center,
      renderTeam(away, 'away', match),
    ),
    h(
      'div',
      { class: 'match-meta' },
      league && logo(league.image, 'mini-logo'),
      h('span', {}, [match.leagueName, match.blockName, match.bestOf && `Bo${match.bestOf}`].filter(Boolean).join(' · ')),
    ),
    h(
      'div',
      { class: 'badges' },
      match.isPlaceholder && h('span', { class: 'badge placeholder' }, 'TBD'),
      match.state === 'inProgress' &&
        h('a', { ...externalLink(leagueUrl(match.leagueSlug)), class: 'badge live' }, 'Live'),
      vod && h('a', { ...externalLink(vod), class: 'badge vod' }, 'VOD'),
    ),
  )
}

const renderSchedule = () => {
  const upcoming = upcomingMatches()
  const leagueBySlug = new Map(state.leagues.map((l) => [l.slug, l]))
  const slugsWithMatches = [...new Set(upcoming.map((m) => m.leagueSlug))]
  const hiddenActive = slugsWithMatches.filter((slug) => state.hidden.has(slug))
  const visible = upcoming.filter((m) => !state.hidden.has(m.leagueSlug))

  const days = new Map<string, StoredMatch[]>()
  for (const match of visible) {
    const day = dayFormat.format(new Date(match.startTime))
    days.set(day, [...(days.get(day) ?? []), match])
  }

  const chip = (params: { id: string; label: string; active: boolean; onclick: () => void; image?: string }) =>
    h(
      'button',
      {
        id: params.id,
        class: `filter-chip${params.active ? ' active' : ''}`,
        type: 'button',
        'aria-pressed': String(params.active),
        onclick: params.onclick,
      },
      params.image !== undefined && logo(params.image, 'mini-logo'),
      params.label,
    )

  const showAll = () =>
    h('button', { class: 'link-button', type: 'button', onclick: () => setShown(null, true) }, 'Show all')

  return h(
    'section',
    { class: 'section', id: 'schedule' },
    h(
      'div',
      { class: 'section-head' },
      h('h2', {}, 'Schedule'),
      !state.loading &&
        h(
          'p',
          { class: 'muted' },
          `${visible.length} matches · ${visible.filter((m) => m.isPlaceholder).length} still TBD · times in your timezone`,
        ),
      hiddenActive.length > 0 &&
        h(
          'p',
          { class: 'muted' },
          `Showing ${slugsWithMatches.length - hiddenActive.length} of ${slugsWithMatches.length} leagues · `,
          showAll(),
        ),
    ),
    slugsWithMatches.length > 1 &&
      h(
        'div',
        { class: 'filters' },
        chip({ id: 'chip-all', label: 'All leagues', active: hiddenActive.length === 0, onclick: () => setShown(null, true) }),
        ...slugsWithMatches.map((slug) => {
          const league = leagueBySlug.get(slug)
          const shown = !state.hidden.has(slug)
          return chip({
            id: `chip-${slug}`,
            label: league?.name ?? slug,
            active: shown,
            onclick: () => setShown(slug, !shown),
            image: league?.image ?? '',
          })
        }),
      ),
    state.loading && h('p', { class: 'muted' }, 'Loading schedule…'),
    !state.loading &&
      visible.length === 0 &&
      h(
        'p',
        { class: 'empty' },
        ...(upcoming.length > 0
          ? ['Every league with upcoming matches is hidden. ', showAll()]
          : ['No upcoming matches.']),
      ),
    ...[...days].map(([day, matches]) =>
      h(
        'div',
        { class: 'day' },
        h('h3', { class: 'day-title' }, day),
        h('ul', { class: 'match-list' }, ...matches.map((m) => renderMatch(m, leagueBySlug))),
      ),
    ),
  )
}

const renderFooter = () =>
  h(
    'footer',
    { class: 'footer' },
    h(
      'p',
      {},
      'Schedule data from ',
      h('a', { href: 'https://lolesports.com/en-GB/' }, 'lolesports.com'),
      '. Not affiliated with or endorsed by Riot Games.',
    ),
    h(
      'p',
      {},
      'No cookies, no tracking. Your league and section choices are saved only in this browser.',
    ),
    h(
      'p',
      {},
      '© 2026 ',
      h('a', { href: 'https://github.com/NotTheRealWallyx' }, '@NotTheRealWallyx'),
      ' · ',
      h('a', { href: 'https://github.com/NotTheRealWallyx/lolCalendar/blob/main/LICENSE' }, 'MIT License'),
    ),
  )

const root = document.querySelector<HTMLDivElement>('#app')

const render = () => {
  // Keep keyboard focus on the same control across full re-renders.
  const focusedId = document.activeElement?.id
  root?.replaceChildren(
    renderTopBar(),
    h('main', { class: 'container' }, renderHero(), renderNotices(), renderLeagues(), renderSchedule()),
    renderFooter(),
  )
  if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true })
}

const load = async () => {
  try {
    const [leagues, history, changes] = await Promise.all([
      getJson<LeaguesFile>(LEAGUES_PATH),
      getJson<History>(HISTORY_PATH),
      getJson<ChangesFile>(CHANGES_PATH).catch(() => null),
    ])
    state.leagues = leagues.leagues
    state.generatedAt = leagues.generatedAt
    state.matches = Object.values(history.matches).sort((a, b) => a.startTime.localeCompare(b.startTime))
    state.changes = changes?.diff ?? null
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
  } finally {
    state.loading = false
    render()
  }
}

render()
void load()
