import { addDays, fromKey, type DateKey } from './dates.ts'
import {
  LIGHTS_OUT_ROUND_MIN,
  SCREENS_OFF_BEFORE_LIGHTS_OUT_MIN,
  SLEEP_HOURS,
  TAHAJJUD_BEFORE_FAJR_MIN,
  TICK_REMINDER_BEFORE_SCREENS_OFF_MIN,
} from './config.ts'
import { prayerTimes } from './prayer.ts'
import type { Settings } from './rules.ts'

export interface NightPlan {
  tickReminder: Date
  screensOff: Date
  lightsOut: Date
  /** When the alarm rings the next morning. */
  wake: Date
  wakeLabel: 'Tahajjud' | 'Wake up'
}

const MINUTE = 60_000

function floorToMinutes(date: Date, step: number): Date {
  const stepMs = step * MINUTE
  const offset = date.getTimezoneOffset() * MINUTE
  return new Date(Math.floor((date.getTime() - offset) / stepMs) * stepMs + offset)
}

/** Everything else is worked back from the alarm, so there are always 7 hours of sleep. */
function workBackFrom(wake: Date): Omit<NightPlan, 'wakeLabel'> {
  const lightsOut = floorToMinutes(new Date(wake.getTime() - SLEEP_HOURS * 60 * MINUTE), LIGHTS_OUT_ROUND_MIN)
  const screensOff = new Date(lightsOut.getTime() - SCREENS_OFF_BEFORE_LIGHTS_OUT_MIN * MINUTE)
  const tickReminder = new Date(screensOff.getTime() - TICK_REMINDER_BEFORE_SCREENS_OFF_MIN * MINUTE)
  return { tickReminder, screensOff, lightsOut, wake }
}

/** The morning alarm after the night of `key`. */
export function wakeAfter(key: DateKey, settings: Settings): Date {
  const morning = addDays(key, 1)
  if (settings.edition === 'deen') {
    const fajr = prayerTimes(morning).fajr
    return new Date(Math.floor(fajr.getTime() / MINUTE) * MINUTE - TAHAJJUD_BEFORE_FAJR_MIN * MINUTE)
  }
  const [hours, minutes] = settings.wakeTime.split(':').map(Number)
  const date = fromKey(morning)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
}

/** The night that starts on `key`: Tahajjud before Fajr (deen), or the user's wake-up time (standard). */
export function planNight(key: DateKey, settings: Settings): NightPlan {
  return { ...workBackFrom(wakeAfter(key, settings)), wakeLabel: settings.edition === 'deen' ? 'Tahajjud' : 'Wake up' }
}
