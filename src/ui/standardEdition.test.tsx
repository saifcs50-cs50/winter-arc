import { render } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { buildAlarms, buildReminders, scheduledMessage } from '../core/reminders.ts'
import { BONUS_CHOICES, DEFAULT_SETTINGS, rulesFor, type Settings } from '../core/rules.ts'
import { createStore, dayRecord } from '../core/store.ts'
import { memoryStorage } from '../test/setup.ts'
import { AppContext, type AppContextValue, type Platform } from './AppContext.tsx'
import { ArcView } from './arc/ArcView.tsx'
import { ReviewView } from './review/ReviewView.tsx'
import { SettingsView } from './settings/SettingsView.tsx'
import { TodayView } from './today/TodayView.tsx'

/** Anything from the deen edition. The standard edition has no religious goals and must show none of it. */
const RELIGIOUS = /tahajjud|fajr|dhuhr|\basr\b|maghrib|\bisha\b|salah|adhkar|qur.?an|masjid|istighfar|hisn|prayer|sunnah|kahf|tanzil/i

const standard: Settings = { ...DEFAULT_SETTINGS, edition: 'standard', workoutDays: [1, 2, 3, 5, 6] }
const FRIDAY = '2026-10-09'
const MONDAY = '2026-10-05'

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function contextFor(platform: Platform, today: string): AppContextValue {
  const store = createStore({ storage: memoryStorage(), devicePrefix: platform })
  return {
    store,
    state: store.getState(),
    platform,
    today,
    settings: standard,
    get: (day) => store.values(dayRecord(day)),
    setDay: () => {},
    setSetting: () => {},
    status: { kind: 'unpaired', message: 'Enter the pairing code from the Mac app' },
    syncNow: () => {},
    openOverlay: () => {},
    goToDay: () => {},
    goToTab: () => {},
  }
}

function textOf(ui: React.ReactNode, platform: Platform, today: string): string {
  const { container } = render(<AppContext.Provider value={contextFor(platform, today)}>{ui}</AppContext.Provider>)
  const labels = [...container.querySelectorAll('[aria-label], [title], [placeholder]')].map(
    (el) => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''} ${el.getAttribute('placeholder') ?? ''}`,
  )
  return `${container.textContent} ${labels.join(' ')}`
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  vi.stubGlobal('fetch', () => Promise.reject(new Error('no hub in tests')))
})

describe('standard edition shows nothing religious', () => {
  test('rules, reminders, alarms and the settings reply', () => {
    const now = new Date(2026, 8, 30)
    const words = [
      ...rulesFor('standard').flatMap((r) => [r.title, r.hint]),
      ...BONUS_CHOICES.flatMap((r) => [r.title, r.hint]),
      ...buildReminders('2026-10-01', now, standard, 8).flatMap((r) => [r.title, r.body]),
      ...buildAlarms('2026-10-01', now, standard, 8).flatMap((r) => [r.title, r.body]),
      scheduledMessage(standard),
      scheduledMessage({ ...standard, wakeAlarm: false }),
    ]
    expect(words.filter((w) => RELIGIOUS.test(w))).toEqual([])
  })

  test.each([
    ['Today on a Friday', <TodayView day={FRIDAY} onDayChange={() => {}} />, FRIDAY],
    ['Today on a Monday', <TodayView day={MONDAY} onDayChange={() => {}} />, MONDAY],
    ['Settings', <SettingsView />, MONDAY],
    ['Review', <ReviewView />, FRIDAY],
    ['Arc', <ArcView />, FRIDAY],
  ])('%s, on the phone and on the Mac', (_name, ui, today) => {
    for (const platform of ['phone', 'mac'] as const) {
      const text = textOf(ui, platform, today)
      expect(text.length).toBeGreaterThan(50)
      expect(text.match(RELIGIOUS)?.[0] ?? null).toBeNull()
    }
  })

  test('the same screens in the deen edition do show them, so the check is real', () => {
    const deen: Settings = { ...standard, edition: 'deen' }
    const ctx = { ...contextFor('phone', FRIDAY), settings: deen }
    const { container } = render(
      <AppContext.Provider value={ctx}>
        <TodayView day={FRIDAY} onDayChange={() => {}} />
      </AppContext.Provider>,
    )
    expect(container.textContent).toMatch(/Tahajjud/)
    expect(scheduledMessage(deen)).toMatch(/Tahajjud/)
  })
})
