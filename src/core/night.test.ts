import { describe, expect, test } from 'vitest'
import { planNight } from './night.ts'
import { formatTime } from './prayer.ts'
import { DEFAULT_SETTINGS, type Settings } from './rules.ts'

const deen: Settings = { ...DEFAULT_SETTINGS, edition: 'deen' }
const standard: Settings = { ...DEFAULT_SETTINGS, edition: 'standard', wakeTime: '06:15' }
const hm = formatTime

describe('deen night plan', () => {
  test('puts Tahajjud 30 min before the next Fajr and lights out 7 h before that, rounded down', () => {
    const plan = planNight('2026-10-01', deen)
    // Fajr on 2 Oct is 04:58, so Tahajjud 04:28, lights out 21:28 rounded down to 21:25.
    expect(hm(plan.wake)).toBe('04:28')
    expect(plan.wakeLabel).toBe('Tahajjud')
    expect(hm(plan.lightsOut)).toBe('21:25')
    expect(hm(plan.screensOff)).toBe('20:25')
    expect(hm(plan.tickReminder)).toBe('20:15')
  })

  test('shifts later as Fajr moves later in December', () => {
    expect(hm(planNight('2026-12-30', deen).lightsOut)).toBe('22:05')
  })
})

describe('standard night plan', () => {
  test('works back from the wake-up time the user set', () => {
    const plan = planNight('2026-10-01', standard)
    expect(plan.wake.getDate()).toBe(2)
    expect(hm(plan.wake)).toBe('06:15')
    expect(plan.wakeLabel).toBe('Wake up')
    expect(hm(plan.lightsOut)).toBe('23:15')
    expect(hm(plan.screensOff)).toBe('22:15')
  })

  test('always leaves at least 7 hours, in both editions', () => {
    for (const settings of [deen, standard, { ...standard, wakeTime: '05:07' }]) {
      for (const key of ['2026-10-01', '2026-11-15', '2026-12-30']) {
        const plan = planNight(key, settings)
        expect(plan.wake.getTime() - plan.lightsOut.getTime()).toBeGreaterThanOrEqual(7 * 3_600_000)
      }
    }
  })
})
