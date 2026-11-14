import { mergeState, sanitizeState, type FieldValue, type SyncState } from './merge.ts'
import type { DateKey } from './dates.ts'
import type { DayValues } from './rules.ts'

const STATE_KEY = 'wa.state.v1'
const DEVICE_KEY = 'wa.device'

export const dayRecord = (key: DateKey) => `day/${key}`
export const reviewRecord = (weekEnd: DateKey) => `review/${weekEnd}`
export const SETTINGS_RECORD = 'settings'

export interface Store {
  readonly deviceId: string
  getState(): SyncState
  values(record: string): DayValues
  set(record: string, field: string, value: FieldValue): void
  /** Merges state from another device; returns true when anything changed here. */
  mergeRemote(remote: SyncState): boolean
  /** Listeners learn whether a change came from this device or from a sync. */
  subscribe(listener: (source: ChangeSource) => void): () => void
}

export type ChangeSource = 'local' | 'remote'

interface StoreOptions {
  storage: Storage | null
  devicePrefix: string
  now?: () => number
}

function safeGet(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch (error) {
    console.error('Winter Arc could not save locally', error)
  }
}

function loadState(storage: Storage | null): SyncState {
  const raw = safeGet(storage, STATE_KEY)
  if (!raw) return {}
  try {
    return sanitizeState(JSON.parse(raw))
  } catch {
    return {}
  }
}

function loadDeviceId(storage: Storage | null, prefix: string): string {
  const existing = safeGet(storage, DEVICE_KEY)
  if (existing) return existing
  const id = `${prefix}-${Math.random().toString(36).slice(2, 10)}`
  safeSet(storage, DEVICE_KEY, id)
  return id
}

export function createStore({ storage, devicePrefix, now = Date.now }: StoreOptions): Store {
  const deviceId = loadDeviceId(storage, devicePrefix)
  let state = loadState(storage)
  const listeners = new Set<(source: ChangeSource) => void>()
  const valuesCache = new Map<string, DayValues>()

  function commit(next: SyncState, source: ChangeSource) {
    state = next
    valuesCache.clear()
    safeSet(storage, STATE_KEY, JSON.stringify(state))
    listeners.forEach((listener) => listener(source))
  }

  return {
    deviceId,
    getState: () => state,
    values(record) {
      const cached = valuesCache.get(record)
      if (cached) return cached
      const fields = state[record] ?? {}
      const values = Object.fromEntries(Object.entries(fields).map(([name, f]) => [name, f.v]))
      valuesCache.set(record, values)
      return values
    },
    set(record, field, value) {
      const previous = state[record]?.[field]
      // A local edit must beat the value it replaces even if this clock runs behind the other device.
      const t = Math.max(now(), (previous?.t ?? 0) + 1)
      commit({ ...state, [record]: { ...state[record], [field]: { v: value, t, d: deviceId } } }, 'local')
    },
    mergeRemote(remote) {
      const merged = mergeState(state, sanitizeState(remote))
      if (JSON.stringify(merged) === JSON.stringify(state)) return false
      commit(merged, 'remote')
      return true
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
