import { describe, expect, test } from 'vitest'
import { buildAlarms, buildReminders } from './reminders.ts'
import { DEFAULT_SETTINGS, type Settings } from './rules.ts'

const deen: Settings = { ...DEFAULT_SETTINGS, edition: 'deen' }
const standard: Settings = { ...DEFAULT_SETTINGS, edition: 'standard', wakeTime: '06:00' }
const before = new Date(2026, 8, 30)

describe('deen reminders', () => {
  test('gives 8 reminders a day with unique ids', () => {
    const list = buildReminders('2026-10-01', before, deen, 3)
    expect(list).toHaveLength(24)
    expect(new Set(list.map((r) => r.id)).size).toBe(24)
  })

  test('skips reminders that are already in the past', () => {
    const list = buildReminders('2026-10-01', new Date(2026, 9, 1, 13, 0), deen, 1)
    expect(list.map((r) => r.title.split(' ·')[0])).toEqual(['Asr', 'Maghrib', 'Isha', 'Tick your day', 'Screens off', 'Lights out'])
  })

  test('uses the night plan times in the bodies', () => {
    const lights = buildReminders('2026-10-01', before, deen, 1).find((r) => r.title === 'Lights out')!
    expect(lights.body).toBe("Tahajjud alarm at 4:28 AM. That's your 7 hours.")
  })

  test('keeps ids stable between rebuilds so rescheduling replaces rather than duplicates', () => {
    const a = buildReminders('2026-10-01', before, deen, 2).map((r) => r.id)
    const b = buildReminders('2026-10-02', before, deen, 1).map((r) => r.id)
    expect(a.slice(8)).toEqual(b)
  })

  test('sets one Tahajjud alarm per night, 30 minutes before the next Fajr', () => {
    const [alarm] = buildAlarms('2026-10-01', before, deen, 1)
    expect([alarm.at.getHours(), alarm.at.getMinutes()]).toEqual([4, 28])
    expect(alarm.title).toBe('Tahajjud')
    expect(alarm.body).toBe('Fajr is at 4:58 AM.')
  })
})

describe('standard reminders', () => {
  test('has no prayer reminders, only the night routine', () => {
    const list = buildReminders('2026-10-01', before, standard, 1)
    expect(list.map((r) => r.title)).toEqual(['Tick your day', 'Screens off', 'Lights out'])
    expect(list.at(-1)!.body).toBe("Wake-up alarm at 6:00 AM. That's your 7 hours.")
  })

  test('rings the wake-up alarm at the chosen time, or not at all when switched off', () => {
    const [alarm] = buildAlarms('2026-10-01', before, standard, 1)
    expect([alarm.at.getDate(), alarm.at.getHours(), alarm.at.getMinutes()]).toEqual([2, 6, 0])
    expect(alarm.title).toBe('Wake up')
    expect(buildAlarms('2026-10-01', before, { ...standard, wakeAlarm: false }, 3)).toEqual([])
  })
})
