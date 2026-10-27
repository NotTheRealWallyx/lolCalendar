import { describe, expect, it } from 'vitest'
import { parseResponse } from '../lib/lolesports/client'
import { ApiLeaguesResponseSchema, ApiScheduleResponseSchema } from '../lib/lolesports/types'
import { readFixture } from './fixtures'

type ScheduleJson = {
  data: { schedule: { events: Record<string, unknown>[] } }
}

const scheduleJson = () => structuredClone(readFixture('schedule.json')) as ScheduleJson

const parseSchedule = (body: unknown) => parseResponse('getSchedule', ApiScheduleResponseSchema, body)

describe('parseResponse', () => {
  it('accepts the recorded responses', () => {
    expect(() => parseSchedule(scheduleJson())).not.toThrow()
    expect(() =>
      parseResponse('getLeagues', ApiLeaguesResponseSchema, readFixture('leagues.json')),
    ).not.toThrow()
  })

  it('rejects an unknown match state', () => {
    const body = scheduleJson()
    body.data.schedule.events[0]!.state = 'postponed'
    expect(() => parseSchedule(body)).toThrow(/data\.schedule\.events\.0\.state/)
  })

  it('rejects an invalid start time', () => {
    const body = scheduleJson()
    body.data.schedule.events[3]!.startTime = 'soon'
    expect(() => parseSchedule(body)).toThrow(/events\.3\.startTime: Invalid date/)
  })

  it('rejects a response without a schedule', () => {
    expect(() => parseSchedule({ data: {} })).toThrow(/data\.schedule/)
  })

  it('tolerates missing optional fields', () => {
    const body = scheduleJson()
    const event = body.data.schedule.events[0]!
    event.blockName = null
    delete (event.match as Record<string, unknown>).flags
    const parsed = parseSchedule(body).data.schedule.events[0]!
    expect(parsed.blockName).toBe('')
    expect(parsed.match?.flags).toEqual([])
  })
})
