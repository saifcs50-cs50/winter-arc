import { createContext, useContext } from 'react'
import type { DateKey } from '../core/dates.ts'
import type { FieldValue, SyncState } from '../core/merge.ts'
import type { DayValues, Settings } from '../core/rules.ts'
import type { ValuesFor } from '../core/score.ts'
import type { Store } from '../core/store.ts'
import type { SyncStatus } from '../core/sync.ts'

export type Platform = 'phone' | 'mac'
export type Overlay =
  | { kind: 'adhkar'; which: 'morning' | 'evening'; day: DateKey }
  | { kind: 'tasbih'; day: DateKey }
  | { kind: 'workout'; day: DateKey }
  | null

export interface AppContextValue {
  store: Store
  state: SyncState
  platform: Platform
  today: DateKey
  settings: Settings
  get: ValuesFor
  setDay: (day: DateKey, field: string, value: FieldValue) => void
  setSetting: (field: string, value: FieldValue) => void
  status: SyncStatus
  syncNow: () => void
  openOverlay: (overlay: Overlay) => void
  goToDay: (day: DateKey) => void
  goToTab: (tab: Tab) => void
}

export type Tab = 'today' | 'arc' | 'review' | 'settings'

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppContext')
  return ctx
}

export function useDay(day: DateKey): DayValues {
  return useApp().get(day)
}
