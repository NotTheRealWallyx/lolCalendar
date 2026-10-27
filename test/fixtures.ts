import { readFileSync } from 'node:fs'
import { parseResponse } from '../lib/lolesports/client'
import { ApiLeaguesResponseSchema, ApiScheduleResponseSchema } from '../lib/lolesports/types'

export const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))

// Parsed through the same schemas as live responses, so the recorded data also checks them.
export const leaguesFixture = parseResponse('getLeagues', ApiLeaguesResponseSchema, readFixture('leagues.json'))
  .data.leagues
export const scheduleFixture = parseResponse('getSchedule', ApiScheduleResponseSchema, readFixture('schedule.json'))
  .data.schedule.events
