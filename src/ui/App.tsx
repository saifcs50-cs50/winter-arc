import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CalendarDays, ChartColumn, Settings as SettingsIcon, Snowflake } from 'lucide-react'
import { App as CapApp } from '@capacitor/app'
import { toKey, type DateKey } from '../core/dates.ts'
import type { FieldValue } from '../core/merge.ts'
import { settingsFrom } from '../core/rules.ts'
import { dayRecord, SETTINGS_RECORD, type Store } from '../core/store.ts'
import { createSyncer, type SyncStatus, type Transport } from '../core/sync.ts'
import { refreshSocialMinutes, scheduleReminders } from '../platform/phone.ts'
import { AppContext, type AppContextValue, type Overlay, type Platform, type Tab } from './AppContext.tsx'
import { Header } from './Header.tsx'
import { TodayView } from './today/TodayView.tsx'
import { ArcView } from './arc/ArcView.tsx'
import { ReviewView } from './review/ReviewView.tsx'
import { SettingsView } from './settings/SettingsView.tsx'
import { AdhkarReader } from './overlays/AdhkarReader.tsx'
import { Tasbih } from './overlays/Tasbih.tsx'
import { WorkoutSession } from './overlays/WorkoutSession.tsx'

const SYNC_EVERY_MS = 60_000
const CLOCK_TICK_MS = 30_000
const REMINDERS_DAY_KEY = 'wa.remindersScheduledFor'
/** Bump when an update must redo reminders on first open (v2: refreshes the alarm category's wording). */
const REMINDER_SCHEME = 'v2'

const TABS: { id: Tab; label: string; Icon: typeof Snowflake }[] = [
  { id: 'today', label: 'Today', Icon: Snowflake },
  { id: 'arc', label: 'Arc', Icon: CalendarDays },
  { id: 'review', label: 'Review', Icon: ChartColumn },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

function readFlag(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeFlag(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Only a scheduling hint; the worst case is rescheduling again.
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** `?today=2026-10-20` previews the app on another date (Mac only). Nothing stored changes. */
function previewDate(platform: Platform): DateKey | null {
  if (platform !== 'mac') return null
  const value = new URLSearchParams(window.location.search).get('today')
  return value && DATE_KEY.test(value) ? value : null
}

function useToday(platform: Platform): DateKey {
  const preview = previewDate(platform)
  const [today, setToday] = useState(() => preview ?? toKey(new Date()))
  useEffect(() => {
    if (preview) return
    const update = () => setToday(toKey(new Date()))
    const timer = setInterval(update, CLOCK_TICK_MS)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [preview])
  return today
}

interface AppProps {
  store: Store
  transport: Transport
  platform: Platform
}

export function App({ store, transport, platform }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const today = useToday(platform)
  const [tab, setTab] = useState<Tab>('today')
  const [day, setDay] = useState<DateKey>(today)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' })
  const syncer = useMemo(() => createSyncer({ store, transport, onStatus: setStatus }), [store, transport])
  const previousToday = useRef(today)

  // Follow the calendar: if the app was left on "today", move with it past midnight.
  useEffect(() => {
    if (day === previousToday.current) setDay(today)
    previousToday.current = today
  }, [today, day])

  useEffect(() => {
    void syncer.syncNow()
    const timer = setInterval(() => void syncer.syncNow(), SYNC_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && void syncer.syncNow()
    document.addEventListener('visibilitychange', onVisible)
    const unsubscribe = store.subscribe((source) => source === 'local' && syncer.schedule())
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribe()
      syncer.stop()
    }
  }, [store, syncer])

  const settingsRecord = state[SETTINGS_RECORD]
  const settings = useMemo(() => settingsFrom(store.values(SETTINGS_RECORD)), [store, settingsRecord])
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // Phone only: keep three weeks of reminders scheduled, redone each day and whenever the alarm settings change.
  const reminderSignature = `${REMINDER_SCHEME}|${today}|${settings.edition}|${settings.wakeTime}|${settings.wakeAlarm}`
  useEffect(() => {
    if (platform !== 'phone' || readFlag(REMINDERS_DAY_KEY) === reminderSignature) return
    scheduleReminders(today, new Date(), settingsRef.current)
      .then((r) => r === 'ok' && writeFlag(REMINDERS_DAY_KEY, reminderSignature))
      .catch((e) => console.error('reminders', e))
  }, [platform, today, reminderSignature])

  // Phone only: pull today's social-media minutes on open and on every return to the app.
  useEffect(() => {
    if (platform !== 'phone') return
    const refresh = () => {
      refreshSocialMinutes(store, settingsRef.current, toKey(new Date())).catch((e) => console.error('screen time', e))
    }
    refresh()
    const listener = CapApp.addListener('resume', () => {
      refresh()
      void syncer.syncNow()
    })
    return () => void listener.then((l) => l.remove())
  }, [platform, store, syncer])

  const setDayField = useCallback((d: DateKey, field: string, value: FieldValue) => store.set(dayRecord(d), field, value), [store])
  const setSetting = useCallback((field: string, value: FieldValue) => store.set(SETTINGS_RECORD, field, value), [store])
  const goToTab = useCallback((t: Tab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }, [])

  const ctx: AppContextValue = useMemo(
    () => ({
      store,
      state,
      platform,
      today,
      settings,
      get: (d: DateKey) => store.values(dayRecord(d)),
      setDay: setDayField,
      setSetting,
      status,
      syncNow: () => void syncer.syncNow(),
      openOverlay: setOverlay,
      goToDay: (d: DateKey) => {
        setDay(d)
        goToTab('today')
      },
      goToTab,
    }),
    [store, state, platform, today, settings, setDayField, setSetting, status, syncer, goToTab],
  )

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <div className={`page ${tab === 'today' || tab === 'settings' ? '' : 'wide'}`}>
          <Header />
          {previewDate(platform) && (
            <div className="banner info" style={{ margin: '0 0 12px' }}>
              Previewing {today}. Remove ?today= from the address to go back.
            </div>
          )}
        </div>
        {tab === 'today' && <TodayView day={day} onDayChange={setDay} />}
        {tab === 'arc' && <ArcView />}
        {tab === 'review' && <ReviewView />}
        {tab === 'settings' && <SettingsView />}
      </div>
      <nav className="tabbar" aria-label="Sections">
        <div className="tabbar-inner">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => goToTab(id)}>
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </nav>
      {overlay?.kind === 'adhkar' && <AdhkarReader which={overlay.which} day={overlay.day} onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'tasbih' && <Tasbih day={overlay.day} onClose={() => setOverlay(null)} />}
      {overlay?.kind === 'workout' && <WorkoutSession day={overlay.day} onClose={() => setOverlay(null)} />}
    </AppContext.Provider>
  )
}
