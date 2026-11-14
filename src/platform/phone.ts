import { LocalNotifications } from '@capacitor/local-notifications'
import { addDays, fromKey, type DateKey } from '../core/dates.ts'
import { buildAlarms, buildReminders } from '../core/reminders.ts'
import type { Settings } from '../core/rules.ts'
import { dayRecord, type Store } from '../core/store.ts'
import { Native } from './native.ts'

const PRAYER_CHANNEL = 'wa-prayer'
const NIGHT_CHANNEL = 'wa-night'
const DAY_MS = 86_400_000

/** Rebuilds every reminder and the morning alarms for the next three weeks. Safe to call on every open. */
export async function scheduleReminders(today: DateKey, now: Date, settings: Settings): Promise<'ok' | 'denied'> {
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return 'denied'

  if (settings.edition === 'deen') {
    await LocalNotifications.createChannel({ id: PRAYER_CHANNEL, name: 'Prayer times', importance: 4, vibration: true })
  }
  await LocalNotifications.createChannel({ id: NIGHT_CHANNEL, name: 'Night routine', importance: 4, vibration: true })

  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  }
  const reminders = buildReminders(today, now, settings)
  await LocalNotifications.schedule({
    notifications: reminders.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      channelId: r.channel === 'prayer' ? PRAYER_CHANNEL : NIGHT_CHANNEL,
      smallIcon: 'ic_stat_arc',
      schedule: { at: r.at, allowWhileIdle: true },
    })),
  })
  await Native.scheduleAlarms({
    alarms: buildAlarms(today, now, settings).map((a) => ({ id: a.id, at: a.at.getTime(), title: a.title, body: a.body })),
  })
  return 'ok'
}

/** Reads social-app screen time for yesterday and today and records it as the day's minutes. */
export async function refreshSocialMinutes(store: Store, settings: Settings, today: DateKey): Promise<'ok' | 'no-access'> {
  const { granted } = await Native.usageAccess()
  if (!granted) return 'no-access'
  for (const key of [addDays(today, -1), today]) {
    const from = fromKey(key).getTime()
    const to = Math.min(Date.now(), from + DAY_MS)
    const { minutes } = await Native.socialMinutes({ from, to, packages: [...settings.socialApps] })
    const rounded = Math.round(minutes)
    const record = dayRecord(key)
    const values = store.values(record)
    if (values.socialMin !== rounded) store.set(record, 'socialMin', rounded)
    if (values.socialSrc !== 'auto') store.set(record, 'socialSrc', 'auto')
  }
  return 'ok'
}
