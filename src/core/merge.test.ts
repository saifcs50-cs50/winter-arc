import { describe, expect, test } from 'vitest'
import { mergeField, mergeState, sanitizeState, type Field, type FieldValue, type SyncState } from './merge.ts'

const f = (v: FieldValue, t: number, d = 'phone'): Field => ({ v, t, d })

describe('mergeField', () => {
  test('keeps the newer write', () => {
    expect(mergeField(f(true, 1), f(false, 2))).toEqual(f(false, 2))
    expect(mergeField(f(false, 5), f(true, 2))).toEqual(f(false, 5))
  })

  test('breaks timestamp ties by device id so both sides agree', () => {
    const a = f(1, 7, 'mac')
    const b = f(2, 7, 'phone')
    expect(mergeField(a, b)).toEqual(b)
    expect(mergeField(b, a)).toEqual(b)
  })
})

describe('mergeState', () => {
  const phone: SyncState = {
    'day/2026-10-01': { 'r.sleep': f(true, 10), weight: f(80.2, 11) },
  }
  const mac: SyncState = {
    'day/2026-10-01': { 'r.sleep': f(false, 9, 'mac'), journal: f('good day', 12, 'mac') },
    settings: { workoutDays: f([1, 2, 3], 3, 'mac') },
  }

  test('unions records and fields, newest field wins', () => {
    expect(mergeState(phone, mac)).toEqual({
      'day/2026-10-01': { 'r.sleep': f(true, 10), weight: f(80.2, 11), journal: f('good day', 12, 'mac') },
      settings: { workoutDays: f([1, 2, 3], 3, 'mac') },
    })
  })

  test('is commutative, idempotent and does not mutate its inputs', () => {
    const before = JSON.stringify(phone)
    expect(mergeState(phone, mac)).toEqual(mergeState(mac, phone))
    const merged = mergeState(phone, mac)
    expect(mergeState(merged, merged)).toEqual(merged)
    expect(JSON.stringify(phone)).toBe(before)
  })
})

describe('sanitizeState', () => {
  test('drops malformed records, fields and oversized values from untrusted input', () => {
    const input = {
      'day/2026-10-01': {
        ok: { v: 3, t: 1, d: 'phone' },
        noStamp: { v: 3, d: 'phone' },
        badDevice: { v: 3, t: 1, d: 42 },
        huge: { v: 'x'.repeat(20_001), t: 1, d: 'phone' },
        'bad key!': { v: 1, t: 1, d: 'phone' },
        nested: { v: { a: 1 }, t: 1, d: 'phone' },
        list: { v: [1, 2], t: 1, d: 'phone' },
      },
      '../etc': { x: { v: 1, t: 1, d: 'a' } },
      notAnObject: 5,
    }
    expect(sanitizeState(input)).toEqual({
      'day/2026-10-01': { ok: { v: 3, t: 1, d: 'phone' }, list: { v: [1, 2], t: 1, d: 'phone' } },
    })
  })

  test('returns an empty state for non-objects', () => {
    expect(sanitizeState(null)).toEqual({})
    expect(sanitizeState('hi')).toEqual({})
    expect(sanitizeState([1])).toEqual({})
  })
})
