import { describe, expect, test } from 'vitest'
import { addDays, arcDayNumber, arcKeys, ARC_DAYS, fromKey, phaseOf, toKey, weekday, weekOf, arcWeeks } from './dates.ts'

describe('date keys', () => {
  test('round-trips a local date through its key', () => {
    const key = toKey(new Date(2026, 9, 1, 23, 59))
    expect(key).toBe('2026-10-01')
    expect(toKey(fromKey(key))).toBe('2026-10-01')
  })

  test('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', -92)).toBe('2026-09-30')
  })

  test('reads the weekday with Sunday as 0', () => {
    expect(weekday('2026-10-01')).toBe(4) // Thursday
    expect(weekday('2026-10-04')).toBe(0)
  })
})

describe('the arc', () => {
  test('runs 92 days from 1 Oct to 31 Dec', () => {
    const keys = arcKeys()
    expect(keys).toHaveLength(ARC_DAYS)
    expect(keys[0]).toBe('2026-10-01')
    expect(keys.at(-1)).toBe('2026-12-31')
  })

  test('numbers arc days and returns null outside the arc', () => {
    expect(arcDayNumber('2026-10-01')).toBe(1)
    expect(arcDayNumber('2026-12-31')).toBe(92)
    expect(arcDayNumber('2026-09-30')).toBeNull()
    expect(arcDayNumber('2027-01-01')).toBeNull()
  })

  test('names the phase by week: installation, the middle, the close', () => {
    expect(phaseOf(1)).toBe('Installation')
    expect(phaseOf(28)).toBe('Installation')
    expect(phaseOf(29)).toBe('The Middle')
    expect(phaseOf(63)).toBe('The Middle')
    expect(phaseOf(64)).toBe('The Close')
  })

  test('review weeks end on Sunday and the last one ends on 31 Dec', () => {
    expect(weekOf('2026-10-01')).toEqual({ index: 1, start: '2026-10-01', end: '2026-10-04' })
    expect(weekOf('2026-10-05')).toEqual({ index: 2, start: '2026-10-05', end: '2026-10-11' })
    expect(weekOf('2026-12-30')).toEqual({ index: 14, start: '2026-12-28', end: '2026-12-31' })
    expect(weekOf('2026-09-29')).toBeNull()
  })

  test('lists all 14 review weeks covering every arc day once', () => {
    const weeks = arcWeeks()
    expect(weeks).toHaveLength(14)
    const covered = weeks.reduce((sum, w) => sum + arcDayNumber(w.end)! - arcDayNumber(w.start)! + 1, 0)
    expect(covered).toBe(ARC_DAYS)
  })
})
