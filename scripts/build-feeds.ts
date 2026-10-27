import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fetchLeagues, fetchSchedule } from '../lib/lolesports/client'
import { toLeagues, toMatches } from '../lib/model'
import { buildSiteFiles, loadPublishedHistory, type History } from '../lib/site'
import { mergeMatches } from '../lib/sync'

const { values } = parseArgs({ options: { out: { type: 'string', default: 'dist' } } })
const outDir = resolve(values.out)
const siteUrl = process.env.SITE_URL

const loadHistory = async (): Promise<History> => {
  if (!siteUrl) {
    console.warn('SITE_URL not set: starting without match history')
    return { generatedAt: null, matches: {} }
  }
  return loadPublishedHistory(siteUrl)
}

const leagues = toLeagues(await fetchLeagues())
if (leagues.length === 0) throw new Error('lolesports returned no leagues')

const [events, history] = await Promise.all([
  fetchSchedule(leagues.map((l) => l.id)),
  loadHistory(),
])
const now = new Date()
const { matches, diff } = mergeMatches(history.matches, toMatches(events), now)

const files = buildSiteFiles({ leagues, matches, diff, now })
for (const [path, content] of files) {
  const file = resolve(outDir, path)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}

console.log(
  `Wrote ${files.size} files to ${outDir}: ${leagues.length} leagues, ${Object.keys(matches).length} matches ` +
    `(${diff.added.length} new, ${diff.filled.length} filled, ${diff.rescheduled.length} rescheduled, ${diff.updated} updated)`,
)
