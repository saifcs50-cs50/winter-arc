import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan'
import { fromKey, type DateKey } from './dates.ts'
import { PRAYER_LOCATION } from './config.ts'

export type PrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export const PRAYERS: readonly { id: PrayerId; name: string; arabic: string }[] = [
  { id: 'fajr', name: 'Fajr', arabic: 'الفجر' },
  { id: 'dhuhr', name: 'Dhuhr', arabic: 'الظهر' },
  { id: 'asr', name: 'Asr', arabic: 'العصر' },
  { id: 'maghrib', name: 'Maghrib', arabic: 'المغرب' },
  { id: 'isha', name: 'Isha', arabic: 'العشاء' },
]

export type DayPrayerTimes = Record<PrayerId, Date> & { sunrise: Date }

const coordinates = new Coordinates(PRAYER_LOCATION.latitude, PRAYER_LOCATION.longitude)

function params() {
  const p = CalculationMethod.Karachi()
  p.madhab = Madhab.Shafi
  return p
}

export function prayerTimes(key: DateKey): DayPrayerTimes {
  const t = new PrayerTimes(coordinates, fromKey(key), params())
  return { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha }
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatTime12(date: Date): string {
  const h = date.getHours() % 12 || 12
  const suffix = date.getHours() < 12 ? 'AM' : 'PM'
  return `${h}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`
}

/** The prayer whose time is next after `now` today, or null once Isha has passed. */
export function nextPrayer(times: DayPrayerTimes, now: Date): PrayerId | null {
  return PRAYERS.find((p) => times[p.id].getTime() > now.getTime())?.id ?? null
}
