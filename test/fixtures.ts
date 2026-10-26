import { readFileSync } from 'node:fs'
import type { ApiLeaguesResponse, ApiScheduleResponse } from '../server/lolesports/types'

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T

export const leaguesFixture = readFixture<ApiLeaguesResponse>('leagues.json').data.leagues
export const scheduleFixture = readFixture<ApiScheduleResponse>('schedule.json').data.schedule.events
