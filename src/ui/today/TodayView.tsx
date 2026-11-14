import { ChevronLeft, ChevronRight, Star, TriangleAlert, Info } from 'lucide-react'
import { addDays, arcDayNumber, ARC_START, fromKey, weekday, type DateKey } from '../../core/dates.ts'
import { planNight, wakeAfter } from '../../core/night.ts'
import { formatTime12, nextPrayer, PRAYERS, prayerTimes } from '../../core/prayer.ts'
import { GROUP_TITLES, rulesFor, ruleApplies, type RuleDef, type RuleGroup } from '../../core/rules.ts'
import { missStreakBefore, scoreDay } from '../../core/score.ts'
import { useApp } from '../AppContext.tsx'
import { completionColor } from '../ramp.ts'
import { AdhkarRow, CheckRow, CounterBlock, JournalBlock, QuranRow, RestRow, SalahBlock, SocialBlock, StudyBlock, WorkoutBlock } from './rows.tsx'
import { LogSection } from './LogSection.tsx'

const EARLIEST_PRACTICE_DAY = addDays(ARC_START, -3)
const SUNDAY = 0
const GROUP_ORDER: RuleGroup[] = ['deen', 'mind', 'body', 'night']

function dateTitle(day: DateKey, today: DateKey): string {
  if (day === today) return 'Today'
  if (day === addDays(today, -1)) return 'Yesterday'
  return fromKey(day).toLocaleDateString('en-IN', { weekday: 'long' })
}

function RuleView({ rule, day }: { rule: RuleDef; day: DateKey }) {
  const { get, settings } = useApp()
  const values = get(day)
  const score = scoreDay(day, values, settings)
  if (!ruleApplies(rule, day, settings)) return rule.id === 'workout' ? <RestRow rule={rule} day={day} /> : null
  const props = { rule, day, values, done: score.perRule[rule.id] === true }
  if (rule.id === 'workout') return <WorkoutBlock {...props} />
  switch (rule.kind) {
    case 'salah':
      return <SalahBlock {...props} />
    case 'study':
      return <StudyBlock {...props} />
    case 'social':
      return <SocialBlock {...props} />
    case 'counter':
      return <CounterBlock {...props} />
    case 'adhkar':
      return <AdhkarRow {...props} />
    case 'quran':
      return <QuranRow {...props} />
    case 'journal':
      return <JournalBlock {...props} />
    case 'check':
      if (rule.id === 'lightsOut') return <CheckRow {...props} hint={`By ${formatTime12(planNight(day, settings).lightsOut)} tonight`} />
      if (rule.id === 'screensOff') return <CheckRow {...props} hint={`From ${formatTime12(planNight(day, settings).screensOff)}`} />
      if (rule.id === 'wake') return <CheckRow {...props} hint={`Up by ${formatTime12(wakeAfter(addDays(day, -1), settings))}`} />
      return <CheckRow {...props} />
  }
}

const compact = (date: Date) => formatTime12(date).replace(/ (AM|PM)/, '')

function NightLine({ day }: { day: DateKey }) {
  const { settings } = useApp()
  const night = planNight(day, settings)
  return (
    <div className="night-line">
      <span>
        Screens off <b>{compact(night.screensOff)}</b>
      </span>
      <span>
        Lights out <b>{compact(night.lightsOut)}</b>
      </span>
      <span>
        {night.wakeLabel} <b>{compact(night.wake)}</b>
      </span>
    </div>
  )
}

function PrayerCard({ day }: { day: DateKey }) {
  const { today } = useApp()
  const times = prayerTimes(day)
  const next = day === today ? nextPrayer(times, new Date()) : null
  return (
    <div className="card section">
      <div className="prayer-strip">
        {PRAYERS.map((p) => (
          <div key={p.id} className={p.id === next ? 'next' : ''}>
            <div className="name">{p.name}</div>
            <div className="time">{compact(times[p.id])}</div>
          </div>
        ))}
      </div>
      <NightLine day={day} />
    </div>
  )
}

function NightCard({ day }: { day: DateKey }) {
  return (
    <div className="card section night-card">
      <NightLine day={day} />
    </div>
  )
}

function Banners({ day }: { day: DateKey }) {
  const { today, get, settings, goToTab } = useApp()
  if (day !== today) return null
  const misses = arcDayNumber(today) ? missStreakBefore(today, get, settings) : 0
  return (
    <>
      {misses === 1 && (
        <div className="banner warn" role="status">
          <TriangleAlert className="banner-icon" size={18} />
          <div>
            <strong>Yesterday missed core. Never miss twice.</strong>
            One miss is fine. Two in a row starts a new habit, so today decides.
          </div>
        </div>
      )}
      {misses >= 2 && (
        <div className="banner warn" role="status">
          <TriangleAlert className="banner-icon" size={18} />
          <div>
            <strong>{misses} misses in a row. Reset today.</strong>
            Forget the bonus list. Just get the 5 core rules done.
          </div>
        </div>
      )}
      {weekday(today) === SUNDAY && arcDayNumber(today) && (
        <div className="banner info">
          <Info className="banner-icon" size={18} />
          <div>
            <strong>It's Sunday. Your weekly review is ready.</strong>
            <button className="link-btn" onClick={() => goToTab('review')}>
              Open the review
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function TodayView({ day, onDayChange }: { day: DateKey; onDayChange: (day: DateKey) => void }) {
  const { get, settings, today } = useApp()
  const score = scoreDay(day, get(day), settings)
  const arcDay = arcDayNumber(day)
  const rules = rulesFor(settings.edition)
  const core = rules.filter((r) => r.core)
  return (
    <div className="page">
      <div className="date-nav">
        <button className="icon-btn" aria-label="Previous day" disabled={day <= EARLIEST_PRACTICE_DAY} onClick={() => onDayChange(addDays(day, -1))}>
          <ChevronLeft size={20} />
        </button>
        <div className="date-label">
          {dateTitle(day, today)}
          <small>
            {fromKey(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {arcDay ? ` · Day ${arcDay}` : ' · practice day'}
          </small>
        </div>
        <button className="icon-btn" aria-label="Next day" disabled={day >= today} onClick={() => onDayChange(addDays(day, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="card progress-card">
        <div className="progress-big">
          {score.done}
          <small> of {score.total} done</small>
        </div>
        <span className={`core-badge ${score.coreComplete ? 'done' : ''}`}>
          <Star size={14} fill={score.coreComplete ? 'currentColor' : 'none'} />
          {score.coreComplete ? 'Day counts' : `Core ${score.coreDone}/${score.coreTotal}`}
        </span>
        <div className="progress-track" aria-hidden>
          <div className="progress-fill" style={{ width: `${score.fraction * 100}%`, background: completionColor(score.fraction) }} />
        </div>
      </div>

      <Banners day={day} />
      {settings.edition === 'deen' ? <PrayerCard day={day} /> : <NightCard day={day} />}

      <section className="section" aria-labelledby="core-title">
        <h2 className="section-title" id="core-title">
          Core 5 <span className="count">decides if the day counts</span>
        </h2>
        <div className="stack">
          {core.map((rule) => (
            <RuleView key={rule.id} rule={rule} day={day} />
          ))}
        </div>
      </section>

      {GROUP_ORDER.map((group) => {
        const bonus = rules.filter((r) => !r.core && r.group === group && ruleApplies(r, day, settings))
        if (!bonus.length) return null
        const done = bonus.filter((r) => score.perRule[r.id]).length
        return (
          <section className="section" key={group} aria-label={GROUP_TITLES[group]}>
            <h2 className="section-title">
              {GROUP_TITLES[group]} <span className="count">{done}/{bonus.length}</span>
            </h2>
            <div className="stack">
              {bonus.map((rule) => (
                <RuleView key={rule.id} rule={rule} day={day} />
              ))}
            </div>
          </section>
        )
      })}

      <LogSection day={day} />
    </div>
  )
}
