import { describe, expect, test } from 'vitest'
import { DEFAULT_SETTINGS, type DayValues, type Settings } from './rules.ts'
import { movingAverage, reviewPeriod, series } from './review.ts'

// These tests predate the workout plan and keep the old Mon, Tue, Wed, Fri, Sat workout days.
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, workoutDays: [1, 2, 3, 5, 6] }

const days: Record<string, DayValues> = {
  '2026-10-05': { studyHours: 3, socialMin: 40, weight: 80, mood: 6, 'salah.fajr': true, 'masjid.fajr': true, noReels: true },
  '2026-10-06': { studyHours: 4.5, socialMin: 80, mood: 8, 'salah.fajr': true, 'salah.isha': true, 'masjid.isha': true, noReels: true },
  '2026-10-07': { weight: 79.4 },
}
const get = (key: string) => days[key] ?? {}

describe('reviewPeriod', () => {
  test('sums study, averages social and mood, and tracks weight change up to today', () => {
    const r = reviewPeriod('2026-10-05', '2026-10-11', '2026-10-07', get, SETTINGS)
    expect(r.keys).toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
    expect(r.studyTotal).toBe(7.5)
    expect(r.socialAverage).toBe(60)
    expect(r.moodAverage).toBe(7)
    expect(r.weightChange).toBeCloseTo(-0.6)
    expect(r.salahOnTime).toBe(3)
    expect(r.salahPossible).toBe(15)
    expect(r.masjid).toBe(2)
  })

  test('names the most-missed core rule', () => {
    const r = reviewPeriod('2026-10-05', '2026-10-11', '2026-10-07', get, SETTINGS)
    const social = r.core.find((c) => c.id === 'social')!
    expect(social).toMatchObject({ kept: 1, applicable: 3 })
    // Salah, sleep and workout were all missed on every applicable day; salah comes first among the ties.
    expect(r.mostMissed?.applicable! - r.mostMissed?.kept!).toBe(3)
  })

  test('returns nulls when nothing was logged', () => {
    const r = reviewPeriod('2026-10-12', '2026-10-18', '2026-10-18', () => ({}), SETTINGS)
    expect(r).toMatchObject({ socialAverage: null, weightChange: null, moodAverage: null, counted: 0, studyTotal: 0 })
  })
})

describe('movingAverage', () => {
  test('averages the trailing logged values and keeps gaps as gaps', () => {
    const points = series(['2026-10-05', '2026-10-06', '2026-10-07'], get, 'weight')
    expect(movingAverage(points, 7).map((p) => p.value)).toEqual([80, null, 79.7])
  })
})
