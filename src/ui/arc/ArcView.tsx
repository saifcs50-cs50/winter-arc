import { ARC_DAYS, arcDayNumber, arcKeys, fromKey, weekday, type DateKey } from '../../core/dates.ts'
import { arcSummary, scoreDay } from '../../core/score.ts'
import { useApp } from '../AppContext.tsx'
import { COMPLETION_RAMP, completionColor } from '../ramp.ts'

const WEEKDAY_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const INSTALLATION_DAYS = 28
const MIDDLE_DAYS = 35
const CLOSE_DAYS = 29

function mondayIndex(key: DateKey): number {
  return (weekday(key) + 6) % 7
}

function Month({ keys }: { keys: DateKey[] }) {
  const { today, get, settings, goToDay } = useApp()
  const name = fromKey(keys[0]).toLocaleDateString('en-IN', { month: 'long' })
  const blanks = mondayIndex(keys[0])
  return (
    <div>
      <div className="month-name">{name}</div>
      <div className="cal-grid">
        {WEEKDAY_HEADS.map((d, i) => (
          <div key={i} className="cal-head">
            {d}
          </div>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {keys.map((key) => {
          const date = fromKey(key).getDate()
          if (key > today) {
            return (
              <div key={key} className="cal-cell future" aria-label={`${date}, upcoming`}>
                {date}
              </div>
            )
          }
          const s = scoreDay(key, get(key), settings)
          const label = `${fromKey(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}: ${s.done} of ${s.total} rules${s.coreComplete ? ', day counts' : ''}`
          return (
            <button
              key={key}
              className={`cal-cell ${key === today ? 'today' : ''}`}
              style={{ background: completionColor(s.fraction) }}
              aria-label={label}
              title={label}
              onClick={() => goToDay(key)}
            >
              {date}
              {s.coreComplete && <span className="core-mark" aria-hidden />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ArcView() {
  const { today, get, settings } = useApp()
  const summary = arcSummary(today, get, settings)
  const keys = arcKeys()
  const months = [keys.slice(0, 31), keys.slice(31, 61), keys.slice(61)]
  const dayNumber = arcDayNumber(today) ?? (today > keys[keys.length - 1] ? ARC_DAYS : 0)
  const phaseFill = (start: number, length: number) => `${Math.max(0, Math.min(1, (dayNumber - start) / length)) * 100}%`

  return (
    <div className="page wide">
      <div className="tiles">
        <div className="tile hero">
          <div className="label">Days that counted (all 5 core done)</div>
          <div className="value">
            {summary.counted}
            <small> of {summary.elapsed || ARC_DAYS} {summary.elapsed ? 'so far' : 'days'}</small>
          </div>
        </div>
        <div className="tile">
          <div className="label">Current streak</div>
          <div className="value">
            {summary.currentStreak}
            <small> days</small>
          </div>
        </div>
        <div className="tile">
          <div className="label">Best streak</div>
          <div className="value">
            {summary.bestStreak}
            <small> days</small>
          </div>
        </div>
        <div className="tile">
          <div className="label">Average completion</div>
          <div className="value">{Math.round(summary.averageFraction * 100)}%</div>
        </div>
        <div className="tile">
          <div className="label">Days left</div>
          <div className="value">{ARC_DAYS - dayNumber}</div>
        </div>
      </div>

      <div className="card section">
        <div className="phase-bar" aria-hidden>
          <div>
            <span style={{ width: phaseFill(0, INSTALLATION_DAYS) }} />
          </div>
          <div>
            <span style={{ width: phaseFill(INSTALLATION_DAYS, MIDDLE_DAYS) }} />
          </div>
          <div>
            <span style={{ width: phaseFill(INSTALLATION_DAYS + MIDDLE_DAYS, CLOSE_DAYS) }} />
          </div>
        </div>
        <div className="phase-labels">
          <span>Installation</span>
          <span>The Middle · most people quit here</span>
          <span>The Close</span>
        </div>
      </div>

      <div className="card section">
        <div className="months">
          {months.map((m) => (
            <Month key={m[0]} keys={m} />
          ))}
        </div>
        <div className="legend section">
          <span>
            Fewer
            <span className="legend-ramp" style={{ margin: '0 6px' }}>
              {COMPLETION_RAMP.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
            more rules ticked
          </span>
          <span>
            <span className="dot" />
            All 5 core done
          </span>
        </div>
      </div>
    </div>
  )
}
