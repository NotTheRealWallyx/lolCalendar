import { z } from 'zod'

// Only the fields we use are listed; unknown fields are stripped. Anything that would make us
// publish wrong events (ids, times, teams, states) is strict, so an API change fails the build.

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date')

export const ApiLeagueSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string(),
  region: z.string(),
  image: z.string(),
  displayPriority: z.object({ position: z.number(), status: z.string() }),
})

export const ApiLeaguesResponseSchema = z.object({
  data: z.object({ leagues: z.array(ApiLeagueSchema) }),
})

export const ApiTeamSchema = z.object({
  name: z.string(),
  code: z.string(),
  image: z.string(),
  result: z
    .object({ outcome: z.enum(['win', 'loss']).nullable(), gameWins: z.number() })
    .nullable(),
})

export const ApiEventStateSchema = z.enum(['unstarted', 'inProgress', 'completed'])

export const ApiEventSchema = z.object({
  startTime: isoDateTime,
  state: ApiEventStateSchema,
  type: z.string(),
  blockName: z.string().nullish().transform((value) => value ?? ''),
  league: z.object({ name: z.string(), slug: z.string() }),
  match: z
    .object({
      id: z.string().min(1),
      flags: z.array(z.string()).nullish().transform((value) => value ?? []),
      teams: z.array(ApiTeamSchema),
      strategy: z.object({ type: z.string(), count: z.number() }),
    })
    .optional(),
})

export const ApiScheduleResponseSchema = z.object({
  data: z.object({
    schedule: z.object({
      pages: z.object({ older: z.string().nullable(), newer: z.string().nullable() }),
      events: z.array(ApiEventSchema),
    }),
  }),
})

export type ApiLeague = z.infer<typeof ApiLeagueSchema>
export type ApiTeam = z.infer<typeof ApiTeamSchema>
export type ApiEventState = z.infer<typeof ApiEventStateSchema>
export type ApiEvent = z.infer<typeof ApiEventSchema>
export type ApiLeaguesResponse = z.infer<typeof ApiLeaguesResponseSchema>
export type ApiScheduleResponse = z.infer<typeof ApiScheduleResponseSchema>
