import type { SyncState } from './merge.ts'
import type { Store } from './store.ts'

export type SyncFailure = 'offline' | 'unpaired' | 'error'

export class SyncError extends Error {
  readonly kind: SyncFailure
  constructor(kind: SyncFailure, message: string) {
    super(message)
    this.kind = kind
  }
}

/** Sends this device's full state to the hub and returns the hub's merged state. */
export type Transport = (state: SyncState) => Promise<SyncState>

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'ok'; at: number }
  | { kind: SyncFailure; message: string; lastOk?: number }

interface SyncerOptions {
  store: Store
  transport: Transport
  onStatus: (status: SyncStatus) => void
  debounceMs?: number
  now?: () => number
}

export interface Syncer {
  syncNow(): Promise<void>
  /** Debounced sync after a local edit. */
  schedule(): void
  stop(): void
}

const DEFAULT_DEBOUNCE_MS = 1500

export function createSyncer({ store, transport, onStatus, debounceMs = DEFAULT_DEBOUNCE_MS, now = Date.now }: SyncerOptions): Syncer {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null
  let again = false
  let lastOk: number | undefined

  async function runOnce() {
    onStatus({ kind: 'syncing' })
    try {
      const merged = await transport(store.getState())
      store.mergeRemote(merged)
      lastOk = now()
      onStatus({ kind: 'ok', at: lastOk })
    } catch (error) {
      const kind = error instanceof SyncError ? error.kind : 'error'
      const message = error instanceof Error ? error.message : String(error)
      onStatus({ kind, message, lastOk })
    }
  }

  async function syncNow(): Promise<void> {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await runOnce()
      } while (again)
    })()
    try {
      await running
    } finally {
      running = null
    }
  }

  return {
    syncNow,
    schedule() {
      clearTimeout(timer)
      timer = setTimeout(() => void syncNow(), debounceMs)
    },
    stop() {
      clearTimeout(timer)
    },
  }
}
