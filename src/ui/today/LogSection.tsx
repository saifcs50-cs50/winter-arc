import { useEffect, useState } from 'react'
import type { DateKey } from '../../core/dates.ts'
import { useApp } from '../AppContext.tsx'

const MIN_WEIGHT_KG = 25
const MAX_WEIGHT_KG = 250
const MOODS = Array.from({ length: 10 }, (_, i) => i + 1)

function WeightInput({ day }: { day: DateKey }) {
  const { get, setDay } = useApp()
  const saved = get(day).weight
  const [text, setText] = useState(typeof saved === 'number' ? String(saved) : '')
  useEffect(() => setText(typeof saved === 'number' ? String(saved) : ''), [saved, day])

  function commit(value: string) {
    if (value.trim() === '') return setDay(day, 'weight', null)
    const kg = Number(value.replace(',', '.'))
    if (Number.isFinite(kg) && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG) setDay(day, 'weight', Math.round(kg * 10) / 10)
    else setText(typeof saved === 'number' ? String(saved) : '')
  }

  return (
    <div className="log-row">
      <div>
        <div className="rule-title">Weight</div>
        <div className="rule-hint">Morning, before eating</div>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <input
          className="num-input"
          inputMode="decimal"
          aria-label="Weight in kilograms"
          placeholder="—"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="muted">kg</span>
      </label>
    </div>
  )
}

export function LogSection({ day }: { day: DateKey }) {
  const { get, setDay } = useApp()
  const mood = get(day).mood
  return (
    <section className="section" aria-labelledby="log-title">
      <h2 className="section-title" id="log-title">
        Log <span className="count">tracked, not scored</span>
      </h2>
      <div className="card stack" style={{ gap: 16 }}>
        <WeightInput day={day} />
        <div>
          <div className="rule-title">Energy and mood</div>
          <div className="rule-hint">1 is drained, 10 is on fire</div>
          <div className="mood-scale" role="group" aria-label="Mood from 1 to 10">
            {MOODS.map((m) => (
              <button key={m} aria-pressed={mood === m} onClick={() => setDay(day, 'mood', mood === m ? null : m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
