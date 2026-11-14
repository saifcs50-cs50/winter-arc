import { describe, expect, test } from 'vitest'
import { DEFAULT_SETTINGS, settingsFrom, type DayValues, type Settings } from './rules.ts'
import { arcSummary, missStreakBefore, ruleAdherence, scoreDay } from './score.ts'

// These tests predate the workout plan and keep the old Mon, Tue, Wed, Fri, Sat workout days.
const SETTINGS: Settings = { ...DEFAULT_SETTINGS, workoutDays: [1, 2, 3, 5, 6] }

const ALL_SALAH = { 'salah.fajr': true, 'salah.dhuhr': true, 'salah.asr': true, 'salah.maghrib': true, 'salah.isha': true }
const CORE_DONE: DayValues = {
  ...ALL_SALAH,
  studyHours: 3.5,
  noReels: true,
  socialMin: 42,
  'r.sleep': true,
  'r.workout': true,
}

describe('scoreDay', () => {
  test('a Thursday has 17 of the 19 rules: no Al-Kahf and no workout by default', () => {
    // 2026-10-01 is a Thursday: the fast applies, Al-Kahf does not, and Thursday is not a default workout day.
    const s = scoreDay('2026-10-01', {}, SETTINGS)
    expect(s.total).toBe(17)
    expect(s.applicable.map((r) => r.id)).toContain('fast')
    expect(s.applicable.map((r) => r.id)).not.toContain('kahf')
    expect(s.applicable.map((r) => r.id)).not.toContain('workout')
  })

  test('a rest day completes core with the other 4 core rules', () => {
    const { 'r.workout': _unused, ...withoutWorkout } = CORE_DONE
    const s = scoreDay('2026-10-01', withoutWorkout, SETTINGS)
    expect(s.coreTotal).toBe(4)
    expect(s.coreComplete).toBe(true)
  })

  test('core is incomplete when one prayer is missing', () => {
    const s = scoreDay('2026-10-05', { ...CORE_DONE, 'salah.asr': false }, SETTINGS)
    expect(s.coreDone).toBe(4)
    expect(s.coreComplete).toBe(false)
  })

  test('the social rule needs both no Reels and minutes within the limit', () => {
    const over = scoreDay('2026-10-05', { ...CORE_DONE, socialMin: 61 }, SETTINGS)
    const unknown = scoreDay('2026-10-05', { ...CORE_DONE, socialMin: undefined }, SETTINGS)
    const reels = scoreDay('2026-10-05', { ...CORE_DONE, noReels: false }, SETTINGS)
    expect([over, unknown, reels].map((s) => s.perRule.social)).toEqual([false, false, false])
  })

  test('fraction grows with every ticked rule, bonus included', () => {
    const base = scoreDay('2026-10-05', CORE_DONE, SETTINGS)
    const more = scoreDay('2026-10-05', { ...CORE_DONE, 'r.coldShower': true, istighfar: 100, journal: 'Good day.' }, SETTINGS)
    expect(more.done).toBe(base.done + 3)
    expect(more.fraction).toBeGreaterThan(base.fraction)
    expect(base.fraction).toBeCloseTo(5 / base.total)
  })
})

describe('arcSummary', () => {
  const values: Record<string, DayValues> = {
    '2026-10-01': CORE_DONE,
    '2026-10-02': CORE_DONE,
    '2026-10-03': {},
    '2026-10-04': CORE_DONE,
    '2026-10-05': CORE_DONE,
  }
  const get = (key: string) => values[key] ?? {}

  test('counts core-complete days and streaks up to today', () => {
    const s = arcSummary('2026-10-05', get, SETTINGS)
    expect(s.elapsed).toBe(5)
    expect(s.counted).toBe(4)
    expect(s.currentStreak).toBe(2)
    expect(s.bestStreak).toBe(2)
  })

  test('an unfinished today does not break the streak', () => {
    const s = arcSummary('2026-10-06', get, SETTINGS)
    expect(s.currentStreak).toBe(2)
  })

  test('is empty before the arc starts', () => {
    const s = arcSummary('2026-09-29', get, SETTINGS)
    expect(s).toMatchObject({ elapsed: 0, counted: 0, currentStreak: 0, bestStreak: 0 })
  })
})

describe('never miss twice', () => {
  test('counts consecutive missed days before today', () => {
    const values: Record<string, DayValues> = { '2026-10-01': CORE_DONE }
    const get = (key: string) => values[key] ?? {}
    expect(missStreakBefore('2026-10-02', get, SETTINGS)).toBe(0)
    expect(missStreakBefore('2026-10-03', get, SETTINGS)).toBe(1)
    expect(missStreakBefore('2026-10-04', get, SETTINGS)).toBe(2)
  })

  test('ignores days before the arc', () => {
    expect(missStreakBefore('2026-10-01', () => ({}), SETTINGS)).toBe(0)
  })
})

describe('ruleAdherence', () => {
  test('counts only the days a rule applies', () => {
    const get = (key: string) => (key === '2026-10-05' ? { 'r.fast': true } : {})
    // Week 2 runs Mon 5 Oct to Sun 11 Oct: fasts apply on Mon 5 and Thu 8.
    const keys = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    expect(ruleAdherence('fast', keys, get, SETTINGS)).toEqual({ kept: 1, applicable: 2 })
  })
})

describe('standard edition', () => {
  const standard = { ...SETTINGS, edition: 'standard' as const }

  test('has wake-up in the core instead of salah, and no religious goals', () => {
    const s = scoreDay('2026-10-05', {}, standard)
    const ids = s.applicable.map((r) => r.id)
    expect(s.applicable.filter((r) => r.core).map((r) => r.id)).toEqual(['wake', 'study', 'social', 'sleep', 'workout'])
    expect(ids).not.toContain('salah')
    expect(ids).not.toContain('tahajjud')
    expect(s.total).toBe(12)
  })

  test('counts only the bonus goals the user switched on', () => {
    const picked = { ...standard, bonusRules: ['read' as const, 'noJunk' as const] }
    const s = scoreDay('2026-10-05', { 'r.read': true, 'r.coldShower': true }, picked)
    expect(s.total).toBe(7)
    expect(s.done).toBe(1)
  })
})

describe('settingsFrom', () => {
  test('keeps valid stored values and falls back for bad ones', () => {
    const s = settingsFrom({ wakeTime: '06:45', wakeAlarm: false, bonusRules: ['read', 'salah', 'nonsense'] }, 'standard')
    expect(s).toMatchObject({ edition: 'standard', wakeTime: '06:45', wakeAlarm: false, bonusRules: ['read'] })
    expect(settingsFrom({ wakeTime: '25:99' }, 'standard').wakeTime).toBe('05:30')
    expect(settingsFrom({}, 'deen').bonusRules).toBeNull()
  })
})

describe('default workout days', () => {
  test("the deen edition follows the plan's Tue, Wed, Fri, Sat; the standard edition keeps its placeholder", () => {
    expect(settingsFrom({}, 'deen').workoutDays).toEqual([2, 3, 5, 6])
    expect(settingsFrom({}, 'standard').workoutDays).toEqual([1, 2, 3, 5, 6])
    expect(settingsFrom({ workoutDays: [1, 4] }, 'deen').workoutDays).toEqual([1, 4])
  })
})
