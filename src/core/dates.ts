/** A local calendar day as `YYYY-MM-DD`. */
export type DateKey = string

export const ARC_START: DateKey = '2026-10-01'
export const ARC_END: DateKey = '2026-12-31'
export const ARC_DAYS = 92

const MS_PER_DAY = 86_400_000
const INSTALLATION_LAST_DAY = 28
const MIDDLE_LAST_DAY = 63

export type Phase = 'Installation' | 'The Middle' | 'The Close'

export interface ArcWeek {
  index: number
  start: DateKey
  end: DateKey
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Noon avoids DST edges, and the Mac might travel. */
export function addDays(key: DateKey, days: number): DateKey {
  const date = fromKey(key)
  return toKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12))
}

export function weekday(key: DateKey): number {
  return fromKey(key).getDay()
}

export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / MS_PER_DAY)
}

export function arcDayNumber(key: DateKey): number | null {
  const n = daysBetween(ARC_START, key) + 1
  return n >= 1 && n <= ARC_DAYS ? n : null
}

export function arcKeys(): DateKey[] {
  return Array.from({ length: ARC_DAYS }, (_, i) => addDays(ARC_START, i))
}

export function phaseOf(dayNumber: number): Phase {
  if (dayNumber <= INSTALLATION_LAST_DAY) return 'Installation'
  if (dayNumber <= MIDDLE_LAST_DAY) return 'The Middle'
  return 'The Close'
}

/** Review weeks run Monday to Sunday, clipped to the arc, so the review lands on Sunday. */
export function weekOf(key: DateKey): ArcWeek | null {
  if (arcDayNumber(key) === null) return null
  const daysToSunday = (7 - weekday(key)) % 7
  const sunday = addDays(key, daysToSunday)
  const monday = addDays(sunday, -6)
  const start = arcDayNumber(monday) === null ? ARC_START : monday
  const end = arcDayNumber(sunday) === null ? ARC_END : sunday
  const firstSunday = addDays(ARC_START, (7 - weekday(ARC_START)) % 7)
  const index = daysBetween(firstSunday, sunday) / 7 + 1
  return { index, start, end }
}

export function arcWeeks(): ArcWeek[] {
  const weeks: ArcWeek[] = []
  let key = ARC_START
  while (arcDayNumber(key) !== null) {
    const week = weekOf(key)!
    weeks.push(week)
    key = addDays(week.end, 1)
  }
  return weeks
}

export function keysInRange(start: DateKey, end: DateKey): DateKey[] {
  const count = daysBetween(start, end) + 1
  return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(start, i))
}
