import { describe, expect, test, vi } from 'vitest'
import { memoryStorage } from '../test/setup.ts'
import { mergeState } from './merge.ts'
import { createStore } from './store.ts'
import { createSyncer, SyncError, type SyncStatus, type Transport } from './sync.ts'

function hub(): { transport: Transport; state: () => ReturnType<typeof mergeState> } {
  let state = {}
  return {
    transport: async (incoming) => {
      state = mergeState(state, incoming)
      return state
    },
    state: () => state,
  }
}

describe('syncer', () => {
  test('two devices converge through the hub', async () => {
    const h = hub()
    const phone = createStore({ storage: memoryStorage(), devicePrefix: 'phone', now: () => 100 })
    const mac = createStore({ storage: memoryStorage(), devicePrefix: 'mac', now: () => 200 })
    phone.set('day/2026-10-01', 'r.sleep', true)
    mac.set('day/2026-10-01', 'journal', 'Alhamdulillah')

    const noop = () => {}
    await createSyncer({ store: phone, transport: h.transport, onStatus: noop }).syncNow()
    await createSyncer({ store: mac, transport: h.transport, onStatus: noop }).syncNow()
    await createSyncer({ store: phone, transport: h.transport, onStatus: noop }).syncNow()

    expect(phone.values('day/2026-10-01')).toEqual({ 'r.sleep': true, journal: 'Alhamdulillah' })
    expect(mac.values('day/2026-10-01')).toEqual(phone.values('day/2026-10-01'))
  })

  test('reports ok, and offline with the last good time when the hub is unreachable', async () => {
    const statuses: SyncStatus[] = []
    const store = createStore({ storage: memoryStorage(), devicePrefix: 'phone' })
    let reachable = true
    const transport: Transport = async (s) => {
      if (!reachable) throw new SyncError('offline', 'Mac not found on this network')
      return s
    }
    const syncer = createSyncer({ store, transport, onStatus: (s) => statuses.push(s), now: () => 42 })
    await syncer.syncNow()
    reachable = false
    await syncer.syncNow()
    expect(statuses).toEqual([
      { kind: 'syncing' },
      { kind: 'ok', at: 42 },
      { kind: 'syncing' },
      { kind: 'offline', message: 'Mac not found on this network', lastOk: 42 },
    ])
  })

  test('coalesces overlapping sync calls into one follow-up run', async () => {
    const store = createStore({ storage: memoryStorage(), devicePrefix: 'phone' })
    const transport = vi.fn(async (s) => s)
    const syncer = createSyncer({ store, transport, onStatus: () => {} })
    await Promise.all([syncer.syncNow(), syncer.syncNow(), syncer.syncNow()])
    expect(transport).toHaveBeenCalledTimes(2)
  })

  test('schedule debounces edits into a single sync', async () => {
    vi.useFakeTimers()
    const store = createStore({ storage: memoryStorage(), devicePrefix: 'phone' })
    const transport = vi.fn(async (s) => s)
    const syncer = createSyncer({ store, transport, onStatus: () => {}, debounceMs: 1000 })
    syncer.schedule()
    syncer.schedule()
    await vi.advanceTimersByTimeAsync(1100)
    expect(transport).toHaveBeenCalledTimes(1)
    syncer.stop()
    vi.useRealTimers()
  })
})
