import { describe, expect, test } from 'vitest'
import { prayerTimes, formatTime, PRAYERS } from './prayer.ts'

const hm = (d: Date) => formatTime(d)

// Regression values from the adhan library for the default location (Mecca, UTC+3; the tests run in Asia/Riyadh).
describe('prayer times for the default location (Karachi method, Shafi Asr)', () => {
  test('match the expected times for 1 Oct 2026', () => {
    const t = prayerTimes('2026-10-01')
    expect(hm(t.fajr)).toBe('04:58')
    expect(hm(t.dhuhr)).toBe('12:11')
    expect(hm(t.asr)).toBe('15:33')
    expect(hm(t.maghrib)).toBe('18:09')
    expect(hm(t.isha)).toBe('19:22')
  })

  test('lists the five prayers in order', () => {
    expect(PRAYERS.map((p) => p.id)).toEqual(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'])
  })
})
