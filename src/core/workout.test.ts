import { describe, expect, test } from 'vitest'
import { SESSIONS } from '../data/workoutPlan.ts'
import { DEFAULT_SETTINGS, type DayValues, type Settings } from './rules.ts'
import { hitTopOfRange, lastLogged, levelDayField, levelField, readLevel, readSets, sessionFor, sessionReps, setField, shouldProgress, upcomingSession, volumeSeries } from './workout.ts'

const plan: Settings = { ...DEFAULT_SETTINGS, edition: 'deen', workoutDays: [2, 3, 5, 6] }
const bss = SESSIONS[0].exercises[0]

describe('the plan', () => {
  test('has four sessions with unique exercise ids that are safe as synced field names', () => {
    const ids = SESSIONS.flatMap((s) => s.exercises.map((e) => e.id))
    expect(SESSIONS.map((s) => s.id)).toEqual(['lowerA', 'upperA', 'lowerB', 'upperB'])
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(`w.${id}.4`).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,63}$/)
  })

  test('keeps every rep range sensible for light loads: no more than 30 reps', () => {
    for (const e of SESSIONS.flatMap((s) => s.exercises)) {
      expect(e.repMin).toBeGreaterThanOrEqual(6)
      expect(e.repMax).toBeLessThanOrEqual(30)
      expect(e.repMax).toBeGreaterThan(e.repMin)
    }
  })
})

describe('sessionFor', () => {
  test('follows the plan week: Tue Lower A, Wed Upper A, Fri Lower B, Sat Upper B, rest otherwise', () => {
    // Week of Mon 5 Oct 2026.
    const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    expect(week.map((k) => sessionFor(k, plan)?.id ?? 'rest')).toEqual(['rest', 'lowerA', 'upperA', 'rest', 'lowerB', 'upperB', 'rest'])
  })

  test('keeps the session order when the user moves their workout days', () => {
    const moved = { ...plan, workoutDays: [1, 2, 4, 5] }
    expect(['2026-10-05', '2026-10-06', '2026-10-08', '2026-10-09'].map((k) => sessionFor(k, moved)?.id)).toEqual(['lowerA', 'upperA', 'lowerB', 'upperB'])
  })

  test('puts Sunday last in the week, and cycles when there are more than four days', () => {
    const many = { ...plan, workoutDays: [0, 1, 2, 3, 4] }
    expect(sessionFor('2026-10-05', many)?.id).toBe('lowerA') // Monday is first
    expect(sessionFor('2026-10-11', many)?.id).toBe('lowerA') // Sunday is fifth, so the cycle wraps
  })

  test('on a rest day the plan opens on the next session coming up', () => {
    expect(upcomingSession('2026-10-01', plan).id).toBe('lowerB') // Thursday rest, Friday Lower B
    expect(upcomingSession('2026-10-04', plan).id).toBe('lowerA') // Sunday rest, Tuesday Lower A
    expect(upcomingSession('2026-10-06', plan).id).toBe('lowerA')
    expect(upcomingSession('2026-10-06', { ...plan, workoutDays: [] }).id).toBe('lowerA')
  })

  test('has no plan in the standard edition', () => {
    expect(sessionFor('2026-10-06', { ...plan, edition: 'standard' })).toBeNull()
  })
})

describe('set logging', () => {
  const day: DayValues = { [setField(bss, 0)]: 15, [setField(bss, 1)]: 15, [setField(bss, 2)]: 12 }

  test('reads the reps logged for each set, with gaps as null', () => {
    expect(readSets(day, bss)).toEqual([15, 15, 12])
    expect(readSets({ [setField(bss, 1)]: 9 }, bss)).toEqual([null, 9, null])
  })

  test('totals a session and knows when every set reached the top of the range', () => {
    expect(sessionReps(day, SESSIONS[0])).toBe(42)
    expect(hitTopOfRange(day, bss)).toBe(false)
    expect(hitTopOfRange({ ...day, [setField(bss, 2)]: 15 }, bss)).toBe(true)
    expect(hitTopOfRange({}, bss)).toBe(false)
  })

  test('finds the last time an exercise was logged before a given day', () => {
    const days: Record<string, DayValues> = { '2026-10-06': day, '2026-10-13': { [setField(bss, 0)]: 16 } }
    const get = (k: string) => days[k] ?? {}
    expect(lastLogged('2026-10-13', bss, get)).toEqual({ key: '2026-10-06', sets: [15, 15, 12] })
    expect(lastLogged('2026-10-20', bss, get)).toEqual({ key: '2026-10-13', sets: [16, null, null] })
    expect(lastLogged('2026-10-06', bss, get)).toBeNull()
  })

  test('charts total reps only for days with a logged session', () => {
    const days: Record<string, DayValues> = { '2026-10-06': day }
    const points = volumeSeries(['2026-10-05', '2026-10-06'], (k) => days[k] ?? {})
    expect(points).toEqual([
      { key: '2026-10-05', value: null },
      { key: '2026-10-06', value: 42 },
    ])
  })
})

describe('progression level', () => {
  test('defaults to step 1 and clamps stored values to the ladder', () => {
    expect(readLevel({}, bss)).toBe(0)
    expect(readLevel({ [levelField(bss)]: 3 }, bss)).toBe(3)
    expect(readLevel({ [levelField(bss)]: 99 }, bss)).toBe(5)
    expect(readLevel({ [levelField(bss)]: 'x' }, bss)).toBe(0)
  })
})

describe('shouldProgress', () => {
  const top: DayValues = { [setField(bss, 0)]: 15, [setField(bss, 1)]: 15, [setField(bss, 2)]: 15 }
  const days: Record<string, DayValues> = { '2026-10-06': top }
  const get = (k: string) => days[k] ?? {}

  test('prompts on the day every set reaches the top, and again next session until the step changes', () => {
    expect(shouldProgress('2026-10-06', bss, get, {})).toBe(true)
    expect(shouldProgress('2026-10-13', bss, get, {})).toBe(true)
  })

  test('stops prompting once the step was changed on or after that session', () => {
    expect(shouldProgress('2026-10-06', bss, get, { [levelDayField(bss)]: '2026-10-06', [levelField(bss)]: 1 })).toBe(false)
    expect(shouldProgress('2026-10-13', bss, get, { [levelDayField(bss)]: '2026-10-06', [levelField(bss)]: 1 })).toBe(false)
    expect(shouldProgress('2026-10-13', bss, get, { [levelDayField(bss)]: '2026-10-10', [levelField(bss)]: 1 })).toBe(false)
  })

  test('prompts again when the harder version also reaches the top later', () => {
    const later = (k: string) => (k === '2026-10-20' ? top : get(k))
    expect(shouldProgress('2026-10-20', bss, later, { [levelDayField(bss)]: '2026-10-06', [levelField(bss)]: 1 })).toBe(true)
  })

  test('never prompts below the top of the range or on the last step', () => {
    expect(shouldProgress('2026-10-06', bss, () => ({ [setField(bss, 0)]: 14, [setField(bss, 1)]: 15, [setField(bss, 2)]: 15 }), {})).toBe(false)
    expect(shouldProgress('2026-10-06', bss, get, { [levelField(bss)]: 5 })).toBe(false)
  })
})
