import { addDays, arcDayNumber, arcKeys, type DateKey } from './dates.ts'
import { applicableRules, isRuleDone, ruleApplies, rulesFor, type DayValues, type RuleDef, type RuleId, type Settings } from './rules.ts'

export interface DayScore {
  key: DateKey
  applicable: RuleDef[]
  perRule: Partial<Record<RuleId, boolean>>
  done: number
  total: number
  fraction: number
  coreDone: number
  coreTotal: number
  coreComplete: boolean
}

export type ValuesFor = (key: DateKey) => DayValues

export function scoreDay(key: DateKey, values: DayValues, settings: Settings): DayScore {
  const applicable = applicableRules(key, settings)
  const perRule: Partial<Record<RuleId, boolean>> = {}
  for (const rule of applicable) perRule[rule.id] = isRuleDone(rule, values)
  const core = applicable.filter((r) => r.core)
  const done = applicable.filter((r) => perRule[r.id]).length
  const coreDone = core.filter((r) => perRule[r.id]).length
  return {
    key,
    applicable,
    perRule,
    done,
    total: applicable.length,
    fraction: applicable.length ? done / applicable.length : 0,
    coreDone,
    coreTotal: core.length,
    coreComplete: core.length > 0 && coreDone === core.length,
  }
}

export interface ArcSummary {
  elapsed: number
  counted: number
  currentStreak: number
  bestStreak: number
  averageFraction: number
}

function isCounted(key: DateKey, get: ValuesFor, settings: Settings): boolean {
  return scoreDay(key, get(key), settings).coreComplete
}

/** Streaks count core-complete days. Today only extends a streak once it is complete; it never breaks one. */
export function arcSummary(today: DateKey, get: ValuesFor, settings: Settings): ArcSummary {
  const keys = arcKeys().filter((k) => k <= today)
  const scores = keys.map((k) => scoreDay(k, get(k), settings))
  let best = 0
  let run = 0
  for (const s of scores) {
    run = s.coreComplete ? run + 1 : 0
    best = Math.max(best, run)
  }
  let current = 0
  for (let i = scores.length - 1; i >= 0; i--) {
    const s = scores[i]
    if (s.coreComplete) current++
    else if (s.key === today) continue
    else break
  }
  return {
    elapsed: keys.length,
    counted: scores.filter((s) => s.coreComplete).length,
    currentStreak: current,
    bestStreak: best,
    averageFraction: scores.length ? scores.reduce((sum, s) => sum + s.fraction, 0) / scores.length : 0,
  }
}

/** How many arc days in a row before `today` missed core. Two means the "never miss twice" rule broke. */
export function missStreakBefore(today: DateKey, get: ValuesFor, settings: Settings): number {
  let misses = 0
  let key = addDays(today, -1)
  while (arcDayNumber(key) !== null && !isCounted(key, get, settings)) {
    misses++
    key = addDays(key, -1)
  }
  return misses
}

export function ruleAdherence(
  id: RuleId,
  keys: readonly DateKey[],
  get: ValuesFor,
  settings: Settings,
): { kept: number; applicable: number } {
  const rule = rulesFor(settings.edition).find((r) => r.id === id)
  if (!rule) return { kept: 0, applicable: 0 }
  const days = keys.filter((k) => ruleApplies(rule, k, settings))
  return { kept: days.filter((k) => isRuleDone(rule, get(k))).length, applicable: days.length }
}
