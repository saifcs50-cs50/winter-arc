import { X, RotateCcw } from 'lucide-react'
import adhkar from '../../data/adhkar.json'
import { ISTIGHFAR_TARGET } from '../../core/config.ts'
import type { DateKey } from '../../core/dates.ts'
import { useApp } from '../AppContext.tsx'

const ISTIGHFAR = (adhkar as { istighfar: { arabic: string; meaning: string } }).istighfar

export function Tasbih({ day, onClose }: { day: DateKey; onClose: () => void }) {
  const { get, setDay } = useApp()
  const saved = get(day).istighfar
  const count = typeof saved === 'number' ? saved : 0
  const done = count >= ISTIGHFAR_TARGET

  function tap() {
    try {
      navigator.vibrate?.(done ? 0 : count + 1 === ISTIGHFAR_TARGET ? 60 : 10)
    } catch {
      // Vibration is optional.
    }
    setDay(day, 'istighfar', count + 1)
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Istighfar counter">
      <div className="overlay-head">
        <div>
          <h2>Istighfar</h2>
          <div className="muted">{ISTIGHFAR_TARGET} times a day</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="tasbih">
        <p className="arabic" lang="ar" style={{ textAlign: 'center', margin: 0, fontSize: 28 }}>
          {ISTIGHFAR.arabic}
        </p>
        <button className={`tasbih-circle ${done ? 'done' : ''}`} onClick={tap} aria-label={`Count. ${count} of ${ISTIGHFAR_TARGET}`}>
          <span className="tasbih-count">{count}</span>
          <span className="muted">{done ? 'Done. Keep going if you like' : `of ${ISTIGHFAR_TARGET} · tap`}</span>
        </button>
        <button className="pill-btn" onClick={() => setDay(day, 'istighfar', 0)} disabled={count === 0}>
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </div>
  )
}
