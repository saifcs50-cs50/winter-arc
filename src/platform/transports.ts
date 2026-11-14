import { CapacitorHttp } from '@capacitor/core'
import { HUB_PORT } from '../core/config.ts'
import { sanitizeState, type SyncState } from '../core/merge.ts'
import { SyncError, type Transport } from '../core/sync.ts'
import { Native } from './native.ts'

const PAIRING_KEY = 'wa.pairing'
const REDISCOVER_AFTER_MS = 30_000
const CONNECT_TIMEOUT_MS = 3000
const READ_TIMEOUT_MS = 8000

export interface Pairing {
  code: string
  host?: string
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function loadPairing(): Pairing | null {
  try {
    const raw = localStorage.getItem(PAIRING_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed.code === 'string' ? parsed : null
  } catch {
    return null
  }
}

export function savePairing(pairing: Pairing | null): void {
  try {
    if (pairing) localStorage.setItem(PAIRING_KEY, JSON.stringify(pairing))
    else localStorage.removeItem(PAIRING_KEY)
  } catch (error) {
    console.error('Winter Arc could not save the pairing', error)
  }
}

function readState(body: unknown): SyncState {
  const state = typeof body === 'object' && body !== null ? (body as { state?: unknown }).state : undefined
  return sanitizeState(state)
}

/** The Mac page is served by the hub itself, so it syncs with its own origin. */
export function localHubTransport(): Transport {
  let token: string | null = null

  async function fetchToken(): Promise<string> {
    const res = await fetch('/api/local-token')
    if (!res.ok) throw new SyncError('error', `The Mac hub refused this page (${res.status})`)
    const body = (await res.json()) as { token?: unknown }
    if (typeof body.token !== 'string') throw new SyncError('error', 'The Mac hub sent no token')
    return body.token
  }

  return async (state) => {
    try {
      token ??= await fetchToken()
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-wa-token': token },
        body: JSON.stringify({ state }),
      })
      if (res.status === 401) {
        token = null
        throw new SyncError('error', 'The Mac hub rejected the token; retrying')
      }
      if (!res.ok) throw new SyncError('error', `The Mac hub replied ${res.status}`)
      return readState(await res.json())
    } catch (error) {
      if (error instanceof SyncError) throw error
      throw new SyncError('offline', 'The Winter Arc hub is not running on this Mac')
    }
  }
}

/** The phone finds the Mac on the current Wi-Fi or hotspot, then posts its state there. */
export function lanHubTransport(): Transport {
  let lastDiscovery = 0

  async function discover(pairing: Pairing): Promise<string> {
    if (Date.now() - lastDiscovery < REDISCOVER_AFTER_MS && !pairing.host) {
      throw new SyncError('offline', 'Mac not found on this network')
    }
    lastDiscovery = Date.now()
    try {
      const { host } = await Native.findHub({ port: HUB_PORT, lastHost: pairing.host })
      savePairing({ ...pairing, host })
      return host
    } catch {
      throw new SyncError('offline', 'Mac not found on this network')
    }
  }

  async function post(host: string, code: string, state: SyncState) {
    return CapacitorHttp.post({
      url: `http://${host}:${HUB_PORT}/api/sync`,
      headers: { 'content-type': 'application/json', 'x-wa-token': code },
      data: { state },
      connectTimeout: CONNECT_TIMEOUT_MS,
      readTimeout: READ_TIMEOUT_MS,
    })
  }

  return async (state) => {
    const pairing = loadPairing()
    if (!pairing) throw new SyncError('unpaired', 'Enter the pairing code from the Mac app')
    let host = pairing.host ?? (await discover(pairing))
    let res
    try {
      res = await post(host, pairing.code, state)
    } catch {
      host = await discover({ ...pairing, host: undefined })
      try {
        res = await post(host, pairing.code, state)
      } catch {
        throw new SyncError('offline', 'Mac not found on this network')
      }
    }
    if (res.status === 401) throw new SyncError('unpaired', 'The pairing code changed. Enter the code shown on the Mac')
    if (res.status === 429) throw new SyncError('error', 'Too many wrong codes. Wait a minute')
    if (res.status < 200 || res.status >= 300) throw new SyncError('error', `The Mac replied ${res.status}`)
    const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    return readState(body)
  }
}
