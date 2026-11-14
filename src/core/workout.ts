import { PROGRESSION_STEPS, SESSIONS, type Exercise, type Session } from '../data/workoutPlan.ts'
import { addDays, weekday, type DateKey } from './dates.ts'
import type { Point } from './review.ts'
import type { DayValues, Settings } from './rules.ts'
import type { ValuesFor } from './score.ts'

/** How far back to look for the last time an exercise was logged. */
const HISTORY_DAYS = 60
const DAYS_IN_WEEK = 7

/** Monday-first position of a weekday, so the plan's first session lands on the week's first workout day. */
const mondayFirst = (day: number) => (day + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK

/**
 * The session planned for a day: Lower A, Upper A, Lower B, Upper B, in that order across the week's
 * workout days. Null on rest days and in the standard edition, which has no built-in plan.
 */
export function sessionFor(key: DateKey, settings: Settings): Session | null {
  if (settings.edition !== 'deen') return null
  const ordered = [...settings.workoutDays].sort((a, b) => mondayFirst(a) - mondayFirst(b))
  const position = ordered.indexOf(weekday(key))
  return position === -1 ? null : SESSIONS[position % SESSIONS.length]
}

/** The session on `key`, or on a rest day the next one coming up; Lower A if no workout days are set. */
export function upcomingSession(key: DateKey, settings: Settings): Session {
  for (let ahead = 0; ahead < DAYS_IN_WEEK; ahead++) {
    const session = sessionFor(addDays(key, ahead), settings)
    if (session) return session
  }
  return SESSIONS[0]
}

/** Day-record field holding the reps of one set, e.g. `w.bss.0`. */
export function setField(exercise: Exercise, index: number): string {
  return `w.${exercise.id}.${index}`
}

/** Field in the `workout` record holding how far up the progression ladder an exercise is. */
export function levelField(exercise: Exercise): string {
  return `level.${exercise.id}`
}

/** Field in the `workout` record holding the day the step was last changed, so one achievement prompts once. */
export function levelDayField(exercise: Exercise): string {
  return `levelDay.${exercise.id}`
}

export const WORKOUT_RECORD = 'workout'

export function readSets(values: DayValues, exercise: Exercise): (number | null)[] {
  return Array.from({ length: exercise.sets }, (_, i) => {
    const reps = values[setField(exercise, i)]
    return typeof reps === 'number' && reps > 0 ? reps : null
  })
}

export function readLevel(values: DayValues, exercise: Exercise): number {
  const level = values[levelField(exercise)]
  if (typeof level !== 'number' || !Number.isFinite(level)) return 0
  return Math.max(0, Math.min(PROGRESSION_STEPS.length - 1, Math.round(level)))
}

/** Every set logged and at the top of the rep range: time to move up the progression ladder. */
export function hitTopOfRange(values: DayValues, exercise: Exercise): boolean {
  return readSets(values, exercise).every((reps) => reps !== null && reps >= exercise.repMax)
}

/**
 * Whether to suggest the next progression step on `day`: every set reached the top of the range today or
 * the last time this exercise was done, and the step has not been changed since then.
 */
export function shouldProgress(day: DateKey, exercise: Exercise, get: ValuesFor, workoutValues: DayValues): boolean {
  if (readLevel(workoutValues, exercise) >= PROGRESSION_STEPS.length - 1) return false
  const changed = workoutValues[levelDayField(exercise)]
  const changedOn = typeof changed === 'string' ? changed : null
  if (hitTopOfRange(get(day), exercise)) return changedOn === null || changedOn < day
  const previous = lastLogged(day, exercise, get)
  if (!previous || !previous.sets.every((reps) => reps !== null && reps >= exercise.repMax)) return false
  return changedOn === null || changedOn < previous.key
}

export function sessionReps(values: DayValues, session: Session): number {
  return session.exercises.flatMap((e) => readSets(values, e)).reduce<number>((sum, reps) => sum + (reps ?? 0), 0)
}

function dayReps(values: DayValues): number {
  return SESSIONS.reduce((sum, session) => sum + sessionReps(values, session), 0)
}

export interface LoggedSets {
  key: DateKey
  sets: (number | null)[]
}

/** The most recent earlier day on which this exercise has any set logged. */
export function lastLogged(before: DateKey, exercise: Exercise, get: ValuesFor): LoggedSets | null {
  for (let back = 1; back <= HISTORY_DAYS; back++) {
    const key = addDays(before, -back)
    const sets = readSets(get(key), exercise)
    if (sets.some((reps) => reps !== null)) return { key, sets }
  }
  return null
}

/** Total reps logged per day, for the review chart; days without a session are gaps. */
export function volumeSeries(keys: readonly DateKey[], get: ValuesFor): Point[] {
  return keys.map((key) => {
    const total = dayReps(get(key))
    return { key, value: total > 0 ? total : null }
  })
}
