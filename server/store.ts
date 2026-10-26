import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { DEFAULT_ENABLED_LEAGUES } from './config'
import type { StoredMatch } from './sync'

export type Settings = {
  enabledLeagues: string[]
}

export type MatchStore = {
  lastFetchedAt: string | null
  matches: Record<string, StoredMatch>
}

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url))
const SETTINGS_FILE = `${DATA_DIR}settings.json`
const MATCHES_FILE = `${DATA_DIR}matches.json`

const readJson = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw err
  }
}

// Write to a temp file and rename so a crash mid-write can't leave a truncated store.
const writeJson = async (file: string, value: unknown) => {
  await mkdir(DATA_DIR, { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2))
  await rename(tmp, file)
}

export const loadSettings = () =>
  readJson<Settings>(SETTINGS_FILE, { enabledLeagues: DEFAULT_ENABLED_LEAGUES })

export const saveSettings = (settings: Settings) => writeJson(SETTINGS_FILE, settings)

export const loadMatchStore = () =>
  readJson<MatchStore>(MATCHES_FILE, { lastFetchedAt: null, matches: {} })

export const saveMatchStore = (store: MatchStore) => writeJson(MATCHES_FILE, store)
