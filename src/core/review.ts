import { keysInRange, type ArcWeek, type DateKey } from './dates.ts'
import { PRAYERS } from './prayer.ts'
import { rulesFor, type DayValues, type RuleId, type Settings } from './rules.ts'
import { ruleAdherence, scoreDay, type ValuesFor } from './score.ts'

export interface Point {
  key: DateKey
  value: number | null
}

export interface CoreAdherence {
  id: RuleId
  title: string
  kept: number
  applicable: number
}

export interface PeriodReview {
  keys: DateKey[]
  counted: number
  averageFraction: number
  core: CoreAdherence[]
  mostMissed: CoreAdherence | null
  studyTotal: number
  socialAverage: number | null
  weightChange: number | null
  moodAverage: number | null
  salahOnTime: number
  salahPossible: number
  masjid: number
}

const num = (v: DayValues[string]): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function series(keys: readonly DateKey[], get: ValuesFor, field: string): Point[] {
  return keys.map((key) => ({ key, value: num(get(key)[field]) }))
}

export function fractionSeries(keys: readonly DateKey[], get: ValuesFor, settings: Settings): Point[] {
  return keys.map((key) => ({ key, value: scoreDay(key, get(key), settings).fraction }))
}

/** Trailing mean over the last `window` logged values, so gaps don't drag the line to zero. */
export function movingAverage(points: readonly Point[], window: number): Point[] {
  return points.map((point, i) => {
    if (point.value === null) return { key: point.key, value: null }
    const recent = points.slice(Math.max(0, i - window + 1), i + 1).flatMap((p) => (p.value === null ? [] : [p.value]))
    return { key: point.key, value: recent.reduce((a, b) => a + b, 0) / recent.length }
  })
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function present(points: Point[]): number[] {
  return points.flatMap((p) => (p.value === null ? [] : [p.value]))
}

/** Numbers for one review period, using only days up to `today`. */
export function reviewPeriod(start: DateKey, end: DateKey, today: DateKey, get: ValuesFor, settings: Settings): PeriodReview {
  const keys = keysInRange(start, end < today ? end : today)
  const scores = keys.map((k) => scoreDay(k, get(k), settings))
  const core = rulesFor(settings.edition).filter((r) => r.core).map((rule) => ({ id: rule.id, title: rule.title, ...ruleAdherence(rule.id, keys, get, settings) }))
  const missed = core
    .filter((c) => c.applicable > c.kept)
    .sort((a, b) => b.applicable - b.kept - (a.applicable - a.kept))
  const weights = present(series(keys, get, 'weight'))
  const salahTicks = keys.flatMap((k) => PRAYERS.map((p) => get(k)[`salah.${p.id}`] === true))
  const masjidTicks = keys.flatMap((k) => PRAYERS.map((p) => get(k)[`masjid.${p.id}`] === true))
  return {
    keys,
    counted: scores.filter((s) => s.coreComplete).length,
    averageFraction: average(scores.map((s) => s.fraction)) ?? 0,
    core,
    mostMissed: missed[0] ?? null,
    studyTotal: present(series(keys, get, 'studyHours')).reduce((a, b) => a + b, 0),
    socialAverage: average(present(series(keys, get, 'socialMin'))),
    weightChange: weights.length >= 2 ? weights[weights.length - 1] - weights[0] : null,
    moodAverage: average(present(series(keys, get, 'mood'))),
    salahOnTime: salahTicks.filter(Boolean).length,
    salahPossible: salahTicks.length,
    masjid: masjidTicks.filter(Boolean).length,
  }
}

export function reviewWeek(week: ArcWeek, today: DateKey, get: ValuesFor, settings: Settings): PeriodReview {
  return reviewPeriod(week.start, week.end, today, get, settings)
}
