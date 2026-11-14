import { Check, Dumbbell, ExternalLink, Minus, Plus, BookOpen } from 'lucide-react'
import { ISTIGHFAR_TARGET, QURANLY_PACKAGE, SOCIAL_LIMIT_MIN, STUDY_TARGET_HOURS } from '../../core/config.ts'
import type { DateKey } from '../../core/dates.ts'
import { formatTime12, PRAYERS, prayerTimes } from '../../core/prayer.ts'
import type { DayValues, RuleDef } from '../../core/rules.ts'
import { sessionFor, sessionReps } from '../../core/workout.ts'
import { SESSION_MINUTES } from '../../data/workoutPlan.ts'
import { Native } from '../../platform/native.ts'
import { useApp } from '../AppContext.tsx'

interface RowProps {
  rule: RuleDef
  day: DateKey
  values: DayValues
  done: boolean
}

const STUDY_STEP = 0.5
const MAX_STUDY_HOURS = 16

function classes(rule: RuleDef, done: boolean, extra = ''): string {
  return [extra, rule.core ? 'core' : '', done ? 'done' : ''].filter(Boolean).join(' ')
}

function CheckMark({ on }: { on: boolean }) {
  return (
    <span className={`check ${on ? 'on' : ''}`} aria-hidden>
      <Check size={18} strokeWidth={3} />
    </span>
  )
}

function RuleText({ rule, hint }: { rule: RuleDef; hint?: string }) {
  const text = hint ?? rule.hint
  return (
    <span className="rule-body">
      <span className="rule-title">{rule.title}</span>
      {text && <span className="rule-hint" style={{ display: 'block' }}>{text}</span>}
    </span>
  )
}

export function CheckRow({ rule, day, done, hint }: RowProps & { hint?: string }) {
  const { setDay } = useApp()
  return (
    <button className={`rule ${classes(rule, done)}`} aria-pressed={done} onClick={() => setDay(day, `r.${rule.id}`, !done)}>
      <CheckMark on={done} />
      <RuleText rule={rule} hint={hint} />
    </button>
  )
}

export function RestRow({ rule, day }: { rule: RuleDef; day: DateKey }) {
  const { settings, openOverlay } = useApp()
  return (
    <div className="rule core resting" aria-label={`${rule.title}: rest day`}>
      <span className="check" aria-hidden />
      <RuleText rule={rule} hint="Rest day. Counts as done." />
      {settings.edition === 'deen' && (
        <button className="pill-btn" onClick={() => openOverlay({ kind: 'workout', day })}>
          Plan
        </button>
      )}
    </div>
  )
}

/** The workout rule with the day's session from the plan and a way into the set log. */
export function WorkoutBlock({ rule, day, values, done }: RowProps) {
  const { setDay, settings, openOverlay } = useApp()
  const session = sessionFor(day, settings)
  if (!session) return <CheckRow rule={rule} day={day} values={values} done={done} />
  const reps = sessionReps(values, session)
  const hint = reps > 0 ? `${session.focus} · ${reps} reps logged` : `${session.focus} · ${session.exercises.length} exercises · ${SESSION_MINUTES} min`
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <button aria-pressed={done} aria-label="Mark workout done" onClick={() => setDay(day, 'r.workout', !done)}>
          <CheckMark on={done} />
        </button>
        <span className="rule-body">
          <span className="rule-title">Workout · {session.title}</span>
          <span className="rule-hint" style={{ display: 'block' }}>{hint}</span>
        </span>
        <button className="pill-btn primary" onClick={() => openOverlay({ kind: 'workout', day })}>
          <Dumbbell size={15} />
          {reps > 0 ? 'Open' : 'Start'}
        </button>
      </div>
    </div>
  )
}

function MosqueIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 21h16M6 21v-7a6 6 0 0 1 12 0v7M12 5V2M10 21v-4a2 2 0 0 1 4 0v4" />
    </svg>
  )
}

export function SalahBlock({ rule, day, values, done }: RowProps) {
  const { setDay } = useApp()
  const times = prayerTimes(day)
  const masjidCount = PRAYERS.filter((p) => values[`masjid.${p.id}`] === true).length
  const onTime = PRAYERS.filter((p) => values[`salah.${p.id}`] === true).length
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <CheckMark on={done} />
        <RuleText rule={rule} hint={`${onTime}/5 on time · ${masjidCount} at the masjid`} />
      </div>
      <div className="salah-grid">
        {PRAYERS.map((p) => {
          const on = values[`salah.${p.id}`] === true
          return (
            <button key={p.id} className={`salah ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setDay(day, `salah.${p.id}`, !on)}>
              <span className="name">{p.name}</span>
              <span className="time">{formatTime12(times[p.id]).replace(' ', ' ')}</span>
              {on && <Check size={14} strokeWidth={3} color="#8fe3a8" />}
            </button>
          )
        })}
      </div>
      <div className="masjid-row">
        {PRAYERS.map((p) => {
          const on = values[`masjid.${p.id}`] === true
          return (
            <button
              key={p.id}
              className={`masjid ${on ? 'on' : ''}`}
              aria-pressed={on}
              aria-label={`${p.name} at the masjid`}
              onClick={() => setDay(day, `masjid.${p.id}`, !on)}
            >
              <MosqueIcon />
              {on ? 'Masjid' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StudyBlock({ rule, day, values, done }: RowProps) {
  const { setDay } = useApp()
  const hours = typeof values.studyHours === 'number' ? values.studyHours : 0
  const change = (delta: number) => setDay(day, 'studyHours', Math.min(MAX_STUDY_HOURS, Math.max(0, hours + delta)))
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <CheckMark on={done} />
        <RuleText rule={rule} />
        <div className="stepper">
          <button onClick={() => change(-STUDY_STEP)} aria-label="Half an hour less">
            <Minus size={16} />
          </button>
          <span className="value">{hours}h</span>
          <button onClick={() => change(STUDY_STEP)} aria-label="Half an hour more">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="meter" aria-hidden>
        <div style={{ width: `${Math.min(100, (hours / STUDY_TARGET_HOURS) * 100)}%` }} />
      </div>
    </div>
  )
}

export function SocialBlock({ rule, day, values, done }: RowProps) {
  const { setDay, platform } = useApp()
  const minutes = typeof values.socialMin === 'number' ? values.socialMin : null
  const auto = values.socialSrc === 'auto'
  const noReels = values.noReels === true
  const over = minutes !== null && minutes > SOCIAL_LIMIT_MIN
  let source = 'Type minutes, or open the phone app to read them'
  if (auto) source = 'Read from your phone'
  else if (platform === 'phone') source = 'Allow usage access in Settings to fill this in'
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <CheckMark on={done} />
        <RuleText rule={rule} hint={minutes === null ? source : `${minutes} of ${SOCIAL_LIMIT_MIN} min · ${source.toLowerCase()}`} />
      </div>
      <div className={`meter ${over ? 'over' : ''}`} aria-hidden>
        <div style={{ width: `${Math.min(100, ((minutes ?? 0) / SOCIAL_LIMIT_MIN) * 100)}%` }} />
      </div>
      <div className="row-actions">
        <button className={`toggle ${noReels ? 'on' : ''}`} aria-pressed={noReels} onClick={() => setDay(day, 'noReels', !noReels)}>
          {noReels && <Check size={14} strokeWidth={3} />}
          No Reels or Shorts today
        </button>
        {!auto && (
          <label className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Minutes
            <input
              className="num-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={1440}
              value={minutes ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (e.target.value === '') setDay(day, 'socialMin', null)
                else if (Number.isFinite(n) && n >= 0 && n <= 1440) setDay(day, 'socialMin', Math.round(n))
              }}
            />
          </label>
        )}
      </div>
    </div>
  )
}

export function CounterBlock({ rule, day, values, done }: RowProps) {
  const { openOverlay } = useApp()
  const count = typeof values.istighfar === 'number' ? values.istighfar : 0
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <CheckMark on={done} />
        <RuleText rule={rule} hint={`${Math.min(count, ISTIGHFAR_TARGET)} of ${ISTIGHFAR_TARGET} · ${rule.hint}`} />
        <button className="pill-btn primary" onClick={() => openOverlay({ kind: 'tasbih', day })}>
          Count
        </button>
      </div>
    </div>
  )
}

export function AdhkarRow({ rule, day, done }: RowProps) {
  const { setDay, openOverlay } = useApp()
  const which = rule.id === 'adhkarAm' ? 'morning' : 'evening'
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <button aria-pressed={done} aria-label={`Mark ${rule.title} done`} onClick={() => setDay(day, `r.${rule.id}`, !done)}>
          <CheckMark on={done} />
        </button>
        <RuleText rule={rule} />
        <button className="pill-btn primary" onClick={() => openOverlay({ kind: 'adhkar', which, day })}>
          <BookOpen size={15} />
          Read
        </button>
      </div>
    </div>
  )
}

export function QuranRow({ rule, day, done }: RowProps) {
  const { setDay, platform } = useApp()
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <button aria-pressed={done} aria-label={`Mark ${rule.title} done`} onClick={() => setDay(day, `r.${rule.id}`, !done)}>
          <CheckMark on={done} />
        </button>
        <RuleText rule={rule} />
        {platform === 'phone' && (
          <button className="pill-btn" onClick={() => void Native.openApp({ packageName: QURANLY_PACKAGE })}>
            Quranly
            <ExternalLink size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function JournalBlock({ rule, day, values, done }: RowProps) {
  const { setDay } = useApp()
  const text = typeof values.journal === 'string' ? values.journal : ''
  return (
    <div className={`rule-block ${classes(rule, done)}`}>
      <div className="rule-head">
        <CheckMark on={done} />
        <RuleText rule={rule} />
      </div>
      <textarea
        className="textarea"
        placeholder="What went well? What will you fix tomorrow?"
        value={text}
        maxLength={4000}
        onChange={(e) => setDay(day, 'journal', e.target.value)}
      />
    </div>
  )
}
