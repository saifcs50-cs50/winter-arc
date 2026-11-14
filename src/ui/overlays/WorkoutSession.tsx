import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Timer, X } from 'lucide-react'
import { fromKey, type DateKey } from '../../core/dates.ts'
import { lastLogged, levelDayField, levelField, readLevel, readSets, sessionFor, sessionReps, setField, shouldProgress, upcomingSession, WORKOUT_RECORD } from '../../core/workout.ts'
import { PROGRESSION_STEPS, REST_SECONDS, SESSION_MINUTES, SESSIONS, TRAINING_RULES, type Exercise, type SessionId } from '../../data/workoutPlan.ts'
import { useApp } from '../AppContext.tsx'

const MAX_REPS = 200

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Vibration is a nicety; some WebViews block it.
  }
}

function shortDay(key: DateKey): string {
  return fromKey(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function repsLabel(exercise: Exercise): string {
  return `${exercise.sets} × ${exercise.repMin}–${exercise.repMax}${exercise.perSide ? ' per side' : ''}`
}

/** Counts down the 2–3 minute rest between sets and buzzes when it ends. */
function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= endsAt) {
        vibrate([200, 100, 200])
        setEndsAt(null)
      }
    }, 250)
    return () => clearInterval(timer)
  }, [endsAt])
  const left = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000))
  return {
    left,
    running: endsAt !== null,
    start: () => {
      setNow(Date.now())
      setEndsAt(Date.now() + REST_SECONDS * 1000)
    },
    stop: () => setEndsAt(null),
  }
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function ExerciseCard({ exercise, day, onSetLogged }: { exercise: Exercise; day: DateKey; onSetLogged: () => void }) {
  const { get, setDay, store } = useApp()
  const values = get(day)
  const sets = readSets(values, exercise)
  const previous = lastLogged(day, exercise, get)
  const workoutValues = store.values(WORKOUT_RECORD)
  const level = readLevel(workoutValues, exercise)
  const readyToProgress = shouldProgress(day, exercise, get, workoutValues)
  const doneToday = sets.every((r) => r !== null)

  function setLevel(next: number) {
    store.set(WORKOUT_RECORD, levelField(exercise), Math.max(0, Math.min(PROGRESSION_STEPS.length - 1, next)))
    store.set(WORKOUT_RECORD, levelDayField(exercise), day)
  }

  function change(index: number, text: string) {
    if (text === '') return setDay(day, setField(exercise, index), null)
    const reps = Number(text)
    if (Number.isInteger(reps) && reps >= 0 && reps <= MAX_REPS) setDay(day, setField(exercise, index), reps)
  }

  return (
    <article className={`dhikr ${doneToday ? 'complete-soft' : ''}`}>
      <div className="dhikr-top">
        <b>{exercise.name}</b>
        <span>{repsLabel(exercise)}</span>
      </div>
      <p className="exercise-how">{exercise.how}</p>

      <div className="set-grid" style={{ gridTemplateColumns: `repeat(${exercise.sets}, 1fr)` }}>
        {sets.map((reps, i) => (
          <label key={i} className="set-cell">
            <span>Set {i + 1}</span>
            <input
              className="num-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_REPS}
              aria-label={`${exercise.name}, set ${i + 1} reps`}
              placeholder={previous?.sets[i] ? String(previous.sets[i]) : '–'}
              value={reps ?? ''}
              onChange={(e) => change(i, e.target.value)}
              onBlur={(e) => e.target.value !== '' && Number(e.target.value) > 0 && onSetLogged()}
            />
          </label>
        ))}
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        {previous ? `Last time (${shortDay(previous.key)}): ${previous.sets.map((r) => r ?? '–').join(' · ')}` : 'First time logging this. Stop each set with 0–3 reps left.'}
      </div>

      {readyToProgress && (
        <div className="banner info" style={{ marginTop: 10 }}>
          <ChevronUp className="banner-icon" size={18} />
          <div>
            <strong>Every set hit {exercise.repMax}. Make it harder.</strong>
            Next step: {PROGRESSION_STEPS[level + 1]}.
            <button className="link-btn" style={{ display: 'block' }} onClick={() => setLevel(level + 1)}>
              Move up
            </button>
          </div>
        </div>
      )}

      <div className="level-row">
        <span>
          Step {level + 1} of {PROGRESSION_STEPS.length}: <b>{PROGRESSION_STEPS[level]}</b>
        </span>
        <span className="stepper">
          <button aria-label={`${exercise.name}: easier step`} disabled={level === 0} onClick={() => setLevel(level - 1)}>
            <ChevronDown size={16} />
          </button>
          <button aria-label={`${exercise.name}: harder step`} disabled={level === PROGRESSION_STEPS.length - 1} onClick={() => setLevel(level + 1)}>
            <ChevronUp size={16} />
          </button>
        </span>
      </div>
    </article>
  )
}


export function WorkoutSession({ day, onClose }: { day: DateKey; onClose: () => void }) {
  const { get, setDay, settings } = useApp()
  const scheduled = sessionFor(day, settings)
  const [sessionId, setSessionId] = useState<SessionId>(() => upcomingSession(day, settings).id)
  const session = SESSIONS.find((s) => s.id === sessionId)!
  const rest = useRestTimer()
  const values = get(day)
  const total = sessionReps(values, session)
  const finished = values['r.workout'] === true

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Workout">
      <div className="overlay-head">
        <div>
          <h2>
            {session.title} <small className="muted">· {session.focus}</small>
          </h2>
          <div className="muted">
            {session.exercises.length} exercises · about {SESSION_MINUTES} min · {total} reps logged
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      <div className="overlay-body">
        <div className="overlay-inner">
          <div className="segmented session-tabs" role="group" aria-label="Session">
            {SESSIONS.map((s) => (
              <button key={s.id} aria-pressed={s.id === sessionId} onClick={() => setSessionId(s.id)}>
                {s.title}
                {scheduled?.id === s.id ? ' •' : ''}
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: '8px 2px 12px' }}>
            {scheduled ? `Today's session is ${scheduled.title}.` : 'Today is a rest day. You can still look through the plan.'}
          </p>

          <button className={`rest-timer ${rest.running ? 'running' : ''}`} onClick={rest.running ? rest.stop : rest.start}>
            <Timer size={18} />
            {rest.running ? `Rest ${clock(rest.left)} · tap to stop` : `Start ${clock(REST_SECONDS)} rest`}
          </button>

          {session.exercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} day={day} onSetLogged={rest.start} />
          ))}

          <details className="card" style={{ marginBottom: 12 }}>
            <summary className="rule-title">How to train with 5 kg</summary>
            <dl className="rules-list">
              {TRAINING_RULES.map((rule) => (
                <div key={rule.title}>
                  <dt>{rule.title}</dt>
                  <dd>{rule.text}</dd>
                </div>
              ))}
            </dl>
            <p className="rule-title" style={{ marginTop: 12 }}>
              Progression ladder
            </p>
            <ol className="ladder">
              {PROGRESSION_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>

          {scheduled && (
            <button
              className="counter-btn finish-btn"
              onClick={() => {
                setDay(day, 'r.workout', !finished)
                if (!finished) onClose()
              }}
            >
              {finished ? <Check size={18} strokeWidth={3} /> : null}
              {finished ? 'Workout done · tap to undo' : 'Finish workout'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
