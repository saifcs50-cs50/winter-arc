import { describe, expect, test, vi } from 'vitest'
import { memoryStorage } from '../test/setup.ts'
import { createStore, dayRecord } from './store.ts'

describe('store', () => {
  test('writes stamped fields, persists them and reloads them', () => {
    const storage = memoryStorage()
    const store = createStore({ storage, devicePrefix: 'phone', now: () => 1000 })
    store.set(dayRecord('2026-10-01'), 'r.sleep', true)
    expect(store.getState()['day/2026-10-01']['r.sleep']).toEqual({ v: true, t: 1000, d: store.deviceId })

    const reloaded = createStore({ storage, devicePrefix: 'phone' })
    expect(reloaded.deviceId).toBe(store.deviceId)
    expect(reloaded.values('day/2026-10-01')).toEqual({ 'r.sleep': true })
  })

  test('a local edit beats the value it replaces even with a slow clock', () => {
    const store = createStore({ storage: memoryStorage(), devicePrefix: 'mac', now: () => 5 })
    store.mergeRemote({ 'day/2026-10-01': { weight: { v: 80, t: 900, d: 'phone-x' } } })
    store.set('day/2026-10-01', 'weight', 81)
    expect(store.getState()['day/2026-10-01'].weight).toMatchObject({ v: 81, t: 901 })
  })

  test('mergeRemote reports changes and notifies subscribers only when something changed', () => {
    const store = createStore({ storage: memoryStorage(), devicePrefix: 'mac' })
    const listener = vi.fn()
    store.subscribe(listener)
    const remote = { settings: { workoutDays: { v: [1, 3, 5], t: 10, d: 'phone-x' } } }
    expect(store.mergeRemote(remote)).toBe(true)
    expect(store.mergeRemote(remote)).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('remote')
    expect(store.values('settings')).toEqual({ workoutDays: [1, 3, 5] })
  })

  test('survives corrupt saved state and storage that throws', () => {
    const storage = memoryStorage()
    storage.setItem('wa.state.v1', '{not json')
    expect(createStore({ storage, devicePrefix: 'phone' }).getState()).toEqual({})

    const broken = { ...memoryStorage(), getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createStore({ storage: broken as Storage, devicePrefix: 'phone' })
    store.set('day/2026-10-01', 'mood', 7)
    expect(store.values('day/2026-10-01')).toEqual({ mood: 7 })
  })
})
