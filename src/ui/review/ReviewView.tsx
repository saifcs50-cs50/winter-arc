import { useState } from 'react'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { ARC_END, ARC_START, arcDayNumber, arcWeeks, weekOf, type ArcWeek, type DateKey } from '../../core/dates.ts'
import { PRAYERS } from '../../core/prayer.ts'
import { fractionSeries, movingAverage, reviewPeriod, series, type Point } from '../../core/review.ts'
import { reviewRecord } from '../../core/store.ts'
import { volumeSeries } from '../../core/workout.ts'
import { useApp } from '../AppContext.tsx'
import { completionColor } from '../ramp.ts'
import { ColumnChart, DataTable, HBars, LineChart, shortDate } from './charts.tsx'
import { SOCIAL_LIMIT_MIN, STUDY_TARGET_HOURS } from '../../core/config.ts'

type Range = 'week' | 'arc'
const WEIGHT_WINDOW = 7

const pct = (v: number) => `${Math.round(v * 100)}%`
const hours = (v: number) => `${Math.round(v * 10) / 10}h`
const mins = (v: number) => `${Math.round(v)}m`
const kg = (v: number) => `${v.toFixed(1)}`
const whole = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

function currentWeek(today: DateKey): ArcWeek {
  if (today < ARC_START) return arcWeeks()[0]
  if (today > ARC_END) return arcWeeks().at(-1)!
  return weekOf(today)!
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {sub && <small> {sub}</small>}
      </div>
    </div>
  )
}

function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card chart-card">
      <h3>{title}</h3>
      <p className="sub">{sub}</p>
      {children}
    </div>
  )
}

function hasData(points: Point[]): boolean {
  return points.some((p) => p.value !== null)
}

function WeekNotes({ week }: { week: ArcWeek }) {
  const { store, today } = useApp()
  const record = reviewRecord(week.end)
  const values = store.values(record)
  const text = (field: string) => (typeof values[field] === 'string' ? (values[field] as string) : '')
  const set = (field: string, value: string) => store.set(record, field, value)
  if (week.start > today) return null
  return (
    <div className="card section">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Week {week.index} notes</h3>
      <p className="sub muted" style={{ margin: 0 }}>Answer these every Sunday.</p>
      <label className="rule-hint" style={{ display: 'block', marginTop: 12 }}>
        One win from this week
        <textarea className="textarea" maxLength={2000} value={text('win')} onChange={(e) => set('win', e.target.value)} />
      </label>
      <label className="rule-hint" style={{ display: 'block', marginTop: 12 }}>
        One fix for next week
        <textarea className="textarea" maxLength={2000} value={text('fix')} onChange={(e) => set('fix', e.target.value)} />
      </label>
    </div>
  )
}

export function ReviewView() {
  const { today, get, settings } = useApp()
  const weeks = arcWeeks()
  const [range, setRange] = useState<Range>('week')
  const [weekIndex, setWeekIndex] = useState(currentWeek(today).index)
  const week = weeks[weekIndex - 1]
  const start = range === 'week' ? week.start : ARC_START
  const end = range === 'week' ? week.end : ARC_END
  const effectiveToday = today < ARC_START ? ARC_START : today
  const r = reviewPeriod(start, end, effectiveToday, get, settings)
  const started = arcDayNumber(today) !== null || today > ARC_END
  const deen = settings.edition === 'deen'

  const completion = fractionSeries(r.keys, get, settings)
  const study = series(r.keys, get, 'studyHours')
  const social = series(r.keys, get, 'socialMin')
  const weight = series(r.keys, get, 'weight')
  const mood = series(r.keys, get, 'mood')
  const volume = volumeSeries(r.keys, get)
  const salah: Point[] = r.keys.map((key) => ({ key, value: PRAYERS.filter((p) => get(key)[`salah.${p.id}`] === true).length }))

  return (
    <div className="page wide">
      <div className="review-controls">
        <div className="segmented" role="group" aria-label="Range">
          <button aria-pressed={range === 'week'} onClick={() => setRange('week')}>
            Week
          </button>
          <button aria-pressed={range === 'arc'} onClick={() => setRange('arc')}>
            Whole arc
          </button>
        </div>
        {range === 'week' && (
          <div className="date-nav" style={{ margin: 0, gap: 6 }}>
            <button className="icon-btn" aria-label="Previous week" disabled={weekIndex <= 1} onClick={() => setWeekIndex(weekIndex - 1)}>
              <ChevronLeft size={18} />
            </button>
            <div className="date-label" style={{ minWidth: 130 }}>
              Week {week.index}
              <small>
                {shortDate(week.start)} – {shortDate(week.end)}
              </small>
            </div>
            <button
              className="icon-btn"
              aria-label="Next week"
              disabled={weekIndex >= weeks.length || weeks[weekIndex].start > today}
              onClick={() => setWeekIndex(weekIndex + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {!started && <div className="banner info">The arc starts on 1 October. The review fills in as you log days.</div>}

      <div className="tiles section">
        <Tile label="Days counted" value={`${r.counted}`} sub={`of ${r.keys.length}`} />
        <Tile label="Average completion" value={pct(r.averageFraction)} />
        <Tile label="Study" value={hours(r.studyTotal)} sub={r.keys.length ? `${hours(r.studyTotal / r.keys.length)}/day` : ''} />
        <Tile label="Social media" value={r.socialAverage === null ? '—' : mins(r.socialAverage)} sub="avg/day" />
        {deen && <Tile label="Salah on time" value={`${r.salahOnTime}`} sub={`of ${r.salahPossible}`} />}
        {deen && <Tile label="At the masjid" value={`${r.masjid}`} sub="prayers" />}
        <Tile label="Weight change" value={r.weightChange === null ? '—' : `${r.weightChange > 0 ? '+' : ''}${r.weightChange.toFixed(1)}`} sub="kg" />
        <Tile label="Mood" value={r.moodAverage === null ? '—' : r.moodAverage.toFixed(1)} sub="avg of 10" />
      </div>

      {r.mostMissed && (
        <div className="banner warn">
          <TriangleAlert className="banner-icon" size={18} />
          <div>
            <strong>Most missed: {r.mostMissed.title}</strong>
            Kept {r.mostMissed.kept} of {r.mostMissed.applicable} days. Make it smaller or anchor it to something you already do, but keep it.
          </div>
        </div>
      )}

      <div className="chart-grid section">
        <ChartCard title="Daily completion" sub="Share of the day's rules ticked">
          <ColumnChart points={completion} color={completionColor} format={pct} max={1} label="Daily completion" />
          <DataTable rows={completion} format={pct} name="Completion" />
        </ChartCard>
        <ChartCard title="Core rules kept" sub="Days kept out of days the rule applied">
          <HBars items={r.core.map((c) => ({ label: c.title, kept: c.kept, total: c.applicable }))} />
        </ChartCard>
        <ChartCard title="Study hours" sub={`Target ${STUDY_TARGET_HOURS} hours a day`}>
          <ColumnChart points={study} color="var(--series-1)" format={hours} target={{ value: STUDY_TARGET_HOURS, label: `${STUDY_TARGET_HOURS}h` }} label="Study hours per day" />
          <DataTable rows={study} format={hours} name="Hours" />
        </ChartCard>
        <ChartCard title="Social media" sub={`Minutes a day · limit ${SOCIAL_LIMIT_MIN}`}>
          {hasData(social) ? (
            <>
              <ColumnChart points={social} color="var(--series-2)" format={mins} target={{ value: SOCIAL_LIMIT_MIN, label: 'limit' }} label="Social media minutes per day" />
              <DataTable rows={social} format={mins} name="Minutes" />
            </>
          ) : (
            <div className="empty-chart">No screen time yet. It fills in from the phone.</div>
          )}
        </ChartCard>
        <ChartCard title="Weight" sub="Daily weigh-ins and the 7-day average, in kg">
          {weight.filter((p) => p.value !== null).length >= 2 ? (
            <>
              <LineChart
                label="Weight"
                format={kg}
                series={[
                  { name: 'Daily', color: '#74809a', points: weight, line: false, dots: true },
                  { name: '7-day average', color: 'var(--series-1)', points: movingAverage(weight, WEIGHT_WINDOW), line: true, dots: false },
                ]}
              />
              <DataTable rows={weight} format={kg} name="kg" />
            </>
          ) : (
            <div className="empty-chart">Log your weight on at least two days to see the trend.</div>
          )}
        </ChartCard>
        {deen && (
          <ChartCard title="Workout volume" sub="Total reps logged per session. It should creep up week to week.">
            {hasData(volume) ? (
              <>
                <ColumnChart points={volume} color="var(--series-3)" format={whole} label="Total workout reps per day" />
                <DataTable rows={volume} format={whole} name="Reps" />
              </>
            ) : (
              <div className="empty-chart">Log your sets from the Workout rule to see your volume here.</div>
            )}
          </ChartCard>
        )}
        <ChartCard title="Energy and mood" sub="1 to 10">
          {hasData(mood) ? (
            <>
              <LineChart label="Mood" format={whole} domain={[0, 10]} series={[{ name: 'Mood', color: 'var(--series-3)', points: mood, line: true, dots: true }]} />
              <DataTable rows={mood} format={whole} name="Mood" />
            </>
          ) : (
            <div className="empty-chart">Rate your energy on the Today tab to see it here.</div>
          )}
        </ChartCard>
        {deen && (
          <ChartCard title="Salah on time" sub="Prayers on time each day, out of 5">
            <ColumnChart points={salah} color="var(--series-1)" format={whole} max={5} label="Prayers on time per day" />
            <DataTable rows={salah} format={whole} name="Prayers" />
          </ChartCard>
        )}
      </div>

      {range === 'week' && <WeekNotes week={week} />}
    </div>
  )
}
