import { addDays, daysBetween, type DateKey } from './dates.ts'
import { planNight } from './night.ts'
import { formatTime12, prayerTimes, PRAYERS } from './prayer.ts'
import type { Settings } from './rules.ts'

export interface Reminder {
  id: number
  at: Date
  title: string
  body: string
  channel: 'prayer' | 'night'
}

/** Reminders are rebuilt on every app open, so a rolling window keeps us under Android's 500-alarm cap. */
export const REMINDER_WINDOW_DAYS = 21

const ID_EPOCH: DateKey = '2026-01-01'
const SLOTS_PER_DAY = 10
const TICK_SLOT = 5
const SCREENS_SLOT = 6
const LIGHTS_SLOT = 7
const ALARM_SLOT = 9

const PRAYER_BODIES: Record<string, string> = {
  fajr: 'Pray Fajr on time, then your morning adhkar.',
  dhuhr: 'Time for Dhuhr.',
  asr: 'Pray Asr, then your evening adhkar.',
  maghrib: 'Time for Maghrib.',
  isha: 'Time for Isha.',
}

function reminderId(key: DateKey, slot: number): number {
  return daysBetween(ID_EPOCH, key) * SLOTS_PER_DAY + slot
}

function prayerReminders(key: DateKey): Reminder[] {
  const times = prayerTimes(key)
  return PRAYERS.map((p, slot) => ({
    id: reminderId(key, slot),
    at: times[p.id],
    title: `${p.name} · ${formatTime12(times[p.id])}`,
    body: PRAYER_BODIES[p.id],
    channel: 'prayer',
  }))
}

function nightReminders(key: DateKey, settings: Settings): Reminder[] {
  const night = planNight(key, settings)
  const alarmName = night.wakeLabel === 'Tahajjud' ? 'Tahajjud alarm' : 'Wake-up alarm'
  return [
    {
      id: reminderId(key, TICK_SLOT),
      at: night.tickReminder,
      title: 'Tick your day',
      body: `Log today before screens go off at ${formatTime12(night.screensOff)}.`,
      channel: 'night',
    },
    {
      id: reminderId(key, SCREENS_SLOT),
      at: night.screensOff,
      title: 'Screens off',
      body: `Phone away. Lights out at ${formatTime12(night.lightsOut)}.`,
      channel: 'night',
    },
    {
      id: reminderId(key, LIGHTS_SLOT),
      at: night.lightsOut,
      title: 'Lights out',
      body: `${alarmName} at ${formatTime12(night.wake)}. That's your 7 hours.`,
      channel: 'night',
    },
  ]
}

export function buildReminders(fromKey: DateKey, now: Date, settings: Settings, days = REMINDER_WINDOW_DAYS): Reminder[] {
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(fromKey, i)
    return settings.edition === 'deen' ? [...prayerReminders(key), ...nightReminders(key, settings)] : nightReminders(key, settings)
  })
    .flat()
    .filter((r) => r.at.getTime() > now.getTime())
}

/** The morning alarm after each night; it rings like a real alarm clock. */
export function buildAlarms(fromKey: DateKey, now: Date, settings: Settings, days = REMINDER_WINDOW_DAYS): Reminder[] {
  if (settings.edition === 'standard' && !settings.wakeAlarm) return []
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(fromKey, i)
    const night = planNight(key, settings)
    const body =
      night.wakeLabel === 'Tahajjud'
        ? `Fajr is at ${formatTime12(prayerTimes(addDays(key, 1)).fajr)}.`
        : 'Time to get up. Your Winter Arc day starts now.'
    return { id: reminderId(key, ALARM_SLOT), at: night.wake, title: night.wakeLabel, body, channel: 'night' as const }
  }).filter((a) => a.at.getTime() > now.getTime())
}

/** What Settings says after rescheduling; the standard edition must never mention prayers. */
export function scheduledMessage(settings: Settings): string {
  if (settings.edition === 'deen') return 'Reminders and Tahajjud alarms set for the next 3 weeks.'
  return settings.wakeAlarm ? 'Reminders and wake-up alarms set for the next 3 weeks.' : 'Reminders set for the next 3 weeks. The wake-up alarm is off.'
}
