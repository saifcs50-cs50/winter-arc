/**
 * Sync model: every value is a field stamped with the time it was written and the device
 * that wrote it. Merging keeps the newest stamp per field, so the phone and the Mac can edit
 * offline and converge whichever way they meet (last-writer-wins register per field).
 */
export type Scalar = string | number | boolean | null
export type FieldValue = Scalar | number[] | string[]

export interface Field {
  readonly v: FieldValue
  readonly t: number
  readonly d: string
}

export type SyncRecord = Readonly<Record<string, Field>>
export type SyncState = Readonly<Record<string, SyncRecord>>

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,63}$/
const MAX_STRING = 20_000
const MAX_LIST = 64

function isNewer(a: Field, b: Field): boolean {
  if (a.t !== b.t) return a.t > b.t
  return a.d > b.d
}

export function mergeField(a: Field, b: Field): Field {
  return isNewer(b, a) ? b : a
}

export function mergeRecord(a: SyncRecord = {}, b: SyncRecord = {}): SyncRecord {
  const merged: Record<string, Field> = { ...a }
  for (const [name, field] of Object.entries(b)) {
    merged[name] = merged[name] ? mergeField(merged[name], field) : field
  }
  return merged
}

export function mergeState(a: SyncState, b: SyncState): SyncState {
  const merged: Record<string, SyncRecord> = { ...a }
  for (const [key, record] of Object.entries(b)) {
    merged[key] = mergeRecord(merged[key], record)
  }
  return merged
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidValue(v: unknown): v is FieldValue {
  if (v === null || typeof v === 'boolean') return true
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string') return v.length <= MAX_STRING
  if (Array.isArray(v)) {
    return (
      v.length <= MAX_LIST &&
      (v.every((x) => typeof x === 'number' && Number.isFinite(x)) ||
        v.every((x) => typeof x === 'string' && x.length <= 128))
    )
  }
  return false
}

function sanitizeField(raw: unknown): Field | null {
  if (!isPlainObject(raw)) return null
  const { v, t, d } = raw
  if (typeof t !== 'number' || !Number.isFinite(t) || typeof d !== 'string' || d.length > 64) return null
  if (!isValidValue(v)) return null
  return { v, t, d }
}

/** Validates state that arrived over the network before it is merged or stored. */
export function sanitizeState(raw: unknown): SyncState {
  if (!isPlainObject(raw)) return {}
  const clean: Record<string, SyncRecord> = {}
  for (const [key, record] of Object.entries(raw)) {
    if (!KEY_PATTERN.test(key) || key.includes('..') || !isPlainObject(record)) continue
    const fields: Record<string, Field> = {}
    for (const [name, rawField] of Object.entries(record)) {
      if (!KEY_PATTERN.test(name)) continue
      const field = sanitizeField(rawField)
      if (field) fields[name] = field
    }
    if (Object.keys(fields).length > 0) clean[key] = fields
  }
  return clean
}
