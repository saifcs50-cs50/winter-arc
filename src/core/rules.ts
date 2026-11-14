import type { FieldValue } from './merge.ts'
import { weekday, type DateKey } from './dates.ts'
import { ISTIGHFAR_TARGET, SOCIAL_LIMIT_MIN, STUDY_TARGET_HOURS, DEFAULT_SOCIAL_APP_IDS, DEFAULT_WORKOUT_DAYS, DEFAULT_WAKE_TIME } from './config.ts'
import { EDITION, type Edition } from './edition.ts'
import { PLAN_WORKOUT_DAYS } from '../data/workoutPlan.ts'
import { PRAYERS } from './prayer.ts'

export type RuleId =
  | 'wake'
  | 'salah'
  | 'study'
  | 'social'
  | 'sleep'
  | 'workout'
  | 'lightsOut'
  | 'screensOff'
  | 'read'
  | 'journal'
  | 'coldShower'
  | 'noJunk'
  | 'cleanRoom'
  | 'quran'
  | 'adhkarAm'
  | 'adhkarPm'
  | 'tahajjud'
  | 'istighfar'
  | 'fast'
  | 'kahf'

export type RuleKind = 'check' | 'salah' | 'study' | 'social' | 'journal' | 'counter' | 'adhkar' | 'quran'
export type RuleGroup = 'deen' | 'mind' | 'body' | 'night'

export interface RuleDef {
  id: RuleId
  title: string
  hint: string
  core: boolean
  group: RuleGroup
  kind: RuleKind
  /** Weekdays (Sunday = 0) the rule applies on; every day when absent. */
  days?: readonly number[]
}

export type DayValues = Readonly<Record<string, FieldValue | undefined>>

export interface Settings {
  edition: Edition
  workoutDays: readonly number[]
  socialApps: readonly string[]
  /** Bonus rules the user switched on (standard edition); null means all of them. */
  bonusRules: readonly RuleId[] | null
  /** `HH:MM`, standard edition: the wake-up alarm and the time lights-out is worked back from. */
  wakeTime: string
  wakeAlarm: boolean
}

/** The deen edition follows the built-in 4-day plan; the standard edition starts on a placeholder the user edits. */
function defaultWorkoutDays(edition: Edition): readonly number[] {
  return edition === 'deen' ? PLAN_WORKOUT_DAYS : DEFAULT_WORKOUT_DAYS
}

export const DEFAULT_SETTINGS: Settings = {
  edition: EDITION,
  workoutDays: defaultWorkoutDays(EDITION),
  socialApps: DEFAULT_SOCIAL_APP_IDS,
  bonusRules: null,
  wakeTime: DEFAULT_WAKE_TIME,
  wakeAlarm: true,
}

const MONDAY = 1
const THURSDAY = 4
const FRIDAY = 5

const DEEN_RULES: readonly RuleDef[] = [
  { id: 'salah', title: '5 Salah on time', hint: 'Fajr on time means you woke for it', core: true, group: 'deen', kind: 'salah' },
  { id: 'study', title: 'Study 3+ hours', hint: 'Focused study hours, phone away', core: true, group: 'mind', kind: 'study' },
  { id: 'social', title: 'No Reels · social ≤ 60 min', hint: 'Zero Reels/Shorts, social media under an hour', core: true, group: 'mind', kind: 'social' },
  { id: 'sleep', title: '7+ hours sleep', hint: 'Tick in the morning', core: true, group: 'night', kind: 'check' },
  { id: 'workout', title: 'Workout', hint: 'Rest days pass automatically', core: true, group: 'body', kind: 'check' },
  { id: 'tahajjud', title: 'Tahajjud', hint: 'Before Fajr', core: false, group: 'deen', kind: 'check' },
  { id: 'quran', title: 'Quran · Quranly goal', hint: "Hit today's Quranly target", core: false, group: 'deen', kind: 'quran' },
  { id: 'adhkarAm', title: 'Morning adhkar', hint: 'After Fajr · about 6 min', core: false, group: 'deen', kind: 'adhkar' },
  { id: 'adhkarPm', title: 'Evening adhkar', hint: 'After Asr · about 6 min', core: false, group: 'deen', kind: 'adhkar' },
  { id: 'istighfar', title: 'Istighfar ×100', hint: 'Astaghfirullah wa atubu ilayh', core: false, group: 'deen', kind: 'counter' },
  { id: 'fast', title: 'Sunnah fast', hint: 'Mondays and Thursdays', core: false, group: 'deen', kind: 'check', days: [MONDAY, THURSDAY] },
  { id: 'kahf', title: 'Surah Al-Kahf', hint: 'Fridays', core: false, group: 'deen', kind: 'check', days: [FRIDAY] },
  { id: 'read', title: 'Read 5 pages or 1 chapter', hint: 'A book, not a textbook', core: false, group: 'mind', kind: 'check' },
  { id: 'journal', title: 'Journal', hint: '2–3 lines about today', core: false, group: 'mind', kind: 'journal' },
  { id: 'coldShower', title: 'Cold shower', hint: '', core: false, group: 'body', kind: 'check' },
  { id: 'noJunk', title: 'No junk food', hint: 'No fast food, sweets or soft drinks', core: false, group: 'body', kind: 'check' },
  { id: 'cleanRoom', title: 'Make bed + clean room', hint: '', core: false, group: 'body', kind: 'check' },
  { id: 'screensOff', title: 'No screens before bed', hint: 'Phone and laptop away', core: false, group: 'night', kind: 'check' },
  { id: 'lightsOut', title: 'Lights out on time', hint: 'Protects 7 hours before Tahajjud', core: false, group: 'night', kind: 'check' },
]

const byId = (id: RuleId) => DEEN_RULES.find((r) => r.id === id)!

const STANDARD_RULES: readonly RuleDef[] = [
  { id: 'wake', title: 'Wake up early', hint: 'Up by your alarm', core: true, group: 'night', kind: 'check' },
  { ...byId('study'), hint: 'Focused study, phone away' },
  byId('social'),
  byId('sleep'),
  byId('workout'),
  byId('read'),
  byId('journal'),
  byId('coldShower'),
  byId('noJunk'),
  byId('cleanRoom'),
  byId('screensOff'),
  { ...byId('lightsOut'), hint: 'Protects 7 hours before your alarm' },
]

export function rulesFor(edition: Edition): readonly RuleDef[] {
  return edition === 'standard' ? STANDARD_RULES : DEEN_RULES
}

/** Rules of the edition this build was made for. */
export const RULES = rulesFor(EDITION)
export const CORE_RULES = RULES.filter((r) => r.core)

/** The bonus goals a standard-edition user can switch on or off. */
export const BONUS_CHOICES = STANDARD_RULES.filter((r) => !r.core)

const WAKE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isWakeTime(value: unknown): value is string {
  return typeof value === 'string' && WAKE_TIME.test(value)
}

export const GROUP_TITLES: Record<RuleGroup, string> = {
  deen: 'Deen',
  mind: 'Mind',
  body: 'Body',
  night: 'Night',
}

function ruleDays(rule: RuleDef, settings: Settings): readonly number[] | undefined {
  return rule.id === 'workout' ? settings.workoutDays : rule.days
}

function isSwitchedOn(rule: RuleDef, settings: Settings): boolean {
  return rule.core || settings.bonusRules === null || settings.bonusRules.includes(rule.id)
}

export function ruleApplies(rule: RuleDef, key: DateKey, settings: Settings): boolean {
  if (!isSwitchedOn(rule, settings)) return false
  const days = ruleDays(rule, settings)
  return !days || days.includes(weekday(key))
}

export function applicableRules(key: DateKey, settings: Settings): RuleDef[] {
  return rulesFor(settings.edition).filter((rule) => ruleApplies(rule, key, settings))
}

const num = (v: FieldValue | undefined): number | null => (typeof v === 'number' ? v : null)

export function isRuleDone(rule: RuleDef, values: DayValues): boolean {
  switch (rule.kind) {
    case 'salah':
      return PRAYERS.every((p) => values[`salah.${p.id}`] === true)
    case 'study':
      return (num(values.studyHours) ?? 0) >= STUDY_TARGET_HOURS
    case 'social': {
      const minutes = num(values.socialMin)
      return values.noReels === true && minutes !== null && minutes <= SOCIAL_LIMIT_MIN
    }
    case 'journal':
      return typeof values.journal === 'string' && values.journal.trim().length >= 3
    case 'counter':
      return (num(values.istighfar) ?? 0) >= ISTIGHFAR_TARGET
    case 'check':
    case 'adhkar':
    case 'quran':
      return values[`r.${rule.id}`] === true
  }
}

function listOf(value: FieldValue | undefined): readonly (string | number)[] | null {
  return Array.isArray(value) ? value : null
}

export function settingsFrom(values: DayValues, edition: Edition = EDITION): Settings {
  const workoutDays = listOf(values.workoutDays)?.filter((d): d is number => typeof d === 'number')
  const socialApps = listOf(values.socialApps)?.filter((a): a is string => typeof a === 'string')
  const known = new Set<string>(BONUS_CHOICES.map((r) => r.id))
  const bonusRules = listOf(values.bonusRules)?.filter((id): id is RuleId => typeof id === 'string' && known.has(id))
  return {
    edition,
    workoutDays: workoutDays ?? defaultWorkoutDays(edition),
    socialApps: socialApps ?? DEFAULT_SETTINGS.socialApps,
    bonusRules: bonusRules ?? null,
    wakeTime: isWakeTime(values.wakeTime) ? values.wakeTime : DEFAULT_SETTINGS.wakeTime,
    wakeAlarm: typeof values.wakeAlarm === 'boolean' ? values.wakeAlarm : DEFAULT_SETTINGS.wakeAlarm,
  }
}
