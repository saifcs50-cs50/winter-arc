import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fromKey, type DateKey } from '../../core/dates.ts'
import type { Point } from '../../core/review.ts'

const MARGIN = { top: 14, right: 10, bottom: 22, left: 34 }
const MAX_BAR = 24
const BAR_RADIUS = 4
const HEIGHT = 170
const MIN_LABEL_GAP = 34

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const n = value / exp
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * exp
}

export function shortDate(key: DateKey): string {
  return fromKey(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function dayLabel(key: DateKey, count: number): string {
  const d = fromKey(key)
  return count <= 7 ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : String(d.getDate())
}

function labelEvery(count: number, plotWidth: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / MIN_LABEL_GAP))))
}

interface TooltipState {
  x: number
  y: number
  content: ReactNode
}

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null
  return (
    <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.content}
    </div>
  )
}

function YAxis({ max, plotH, width, format }: { max: number; plotH: number; width: number; format: (v: number) => string }) {
  const ticks = [0, max / 2, max]
  return (
    <>
      <g className="grid">
        {ticks.slice(1).map((t) => {
          const y = MARGIN.top + plotH - (t / max) * plotH
          return <line key={t} x1={MARGIN.left} x2={width - MARGIN.right} y1={y} y2={y} />
        })}
      </g>
      <g className="axis">
        {ticks.map((t) => (
          <text key={t} x={MARGIN.left - 6} y={MARGIN.top + plotH - (t / max) * plotH + 3.5} textAnchor="end">
            {format(t)}
          </text>
        ))}
      </g>
      <line className="baseline" x1={MARGIN.left} x2={width - MARGIN.right} y1={MARGIN.top + plotH} y2={MARGIN.top + plotH} />
    </>
  )
}

function roundedTop(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(BAR_RADIUS, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

interface ColumnChartProps {
  points: Point[]
  color: string | ((value: number) => string)
  format: (value: number) => string
  max?: number
  target?: { value: number; label: string }
  label: string
}

export function ColumnChart({ points, color, format, max, target, label }: ColumnChartProps) {
  const [ref, width] = useWidth()
  const [tip, setTip] = useState<TooltipState | null>(null)
  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const values = points.map((p) => p.value ?? 0)
  const top = max ?? niceMax(Math.max(...values, target?.value ?? 0))
  const band = plotW / Math.max(1, points.length)
  const barW = Math.max(2, Math.min(MAX_BAR, band - 2))
  const every = labelEvery(points.length, plotW)
  const y = (v: number) => MARGIN.top + plotH - (Math.min(v, top) / top) * plotH

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setTip(null)}>
      <svg height={HEIGHT} role="img" aria-label={label}>
        <YAxis max={top} plotH={plotH} width={width} format={format} />
        {points.map((p, i) => {
          const x = MARGIN.left + i * band + (band - barW) / 2
          const v = p.value ?? 0
          const fill = typeof color === 'function' ? color(v) : color
          return <path key={p.key} d={roundedTop(x, y(v), barW, MARGIN.top + plotH - y(v))} fill={fill} />
        })}
        {target && (
          <g className="target">
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(target.value)} y2={y(target.value)} />
            <text x={width - MARGIN.right} y={y(target.value) - 4} textAnchor="end">
              {target.label}
            </text>
          </g>
        )}
        <g className="axis">
          {points.map((p, i) =>
            i % every === 0 ? (
              <text key={p.key} x={MARGIN.left + i * band + band / 2} y={HEIGHT - 6} textAnchor="middle">
                {dayLabel(p.key, points.length)}
              </text>
            ) : null,
          )}
        </g>
        {points.map((p, i) => (
          <rect
            key={p.key}
            x={MARGIN.left + i * band}
            y={MARGIN.top}
            width={band}
            height={plotH}
            fill="transparent"
            onPointerEnter={() =>
              setTip({
                x: MARGIN.left + i * band + band / 2,
                y: y(p.value ?? 0),
                content: (
                  <>
                    <div className="v">{p.value === null ? 'Not logged' : format(p.value)}</div>
                    <div className="k">{shortDate(p.key)}</div>
                  </>
                ),
              })
            }
            onPointerDown={() => setTip(null)}
          />
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

export interface LineSeries {
  name: string
  color: string
  points: Point[]
  line: boolean
  dots: boolean
}

interface LineChartProps {
  series: LineSeries[]
  format: (value: number) => string
  domain?: [number, number]
  label: string
}

export function LineChart({ series, format, domain, label }: LineChartProps) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
  const keys = series[0]?.points.map((p) => p.key) ?? []
  const all = series.flatMap((s) => s.points.flatMap((p) => (p.value === null ? [] : [p.value])))
  const [lo, hi] = domain ?? [Math.floor(Math.min(...all) - 0.5), Math.ceil(Math.max(...all) + 0.5)]
  const span = Math.max(1e-6, hi - lo)
  const x = (i: number) => MARGIN.left + (keys.length <= 1 ? plotW / 2 : (i / (keys.length - 1)) * plotW)
  const y = (v: number) => MARGIN.top + plotH - ((v - lo) / span) * plotH
  const every = labelEvery(keys.length, plotW)

  function pathFor(points: Point[]): string {
    let d = ''
    let pen = false
    points.forEach((p, i) => {
      if (p.value === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i)},${y(p.value)}`
      pen = true
    })
    return d
  }

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(keys.length - 1, Math.round(ratio * (keys.length - 1)))))
  }

  const ticks = [lo, (lo + hi) / 2, hi]
  return (
    <div className="chart" ref={ref} onPointerLeave={() => setHover(null)}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}>
              <span className={`swatch ${s.line ? '' : 'dot'}`} style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg height={HEIGHT} role="img" aria-label={label}>
        <g className="grid">
          {ticks.slice(1).map((t) => (
            <line key={t} x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={MARGIN.left - 6} y={y(t) + 3.5} textAnchor="end">
              {format(t)}
            </text>
          ))}
          {keys.map((k, i) =>
            i % every === 0 ? (
              <text key={k} x={x(i)} y={HEIGHT - 6} textAnchor="middle">
                {dayLabel(k, keys.length)}
              </text>
            ) : null,
          )}
        </g>
        <line className="baseline" x1={MARGIN.left} x2={width - MARGIN.right} y1={MARGIN.top + plotH} y2={MARGIN.top + plotH} />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="#33415f" />}
        {series.map((s) => (
          <g key={s.name}>
            {s.line && <path d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {s.dots &&
              s.points.map((p, i) =>
                p.value === null ? null : <circle key={p.key} cx={x(i)} cy={y(p.value)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />,
              )}
          </g>
        ))}
        <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
      </svg>
      {hover !== null && (
        <Tooltip
          tip={{
            x: x(hover),
            y: MARGIN.top,
            content: (
              <>
                <div className="k">{shortDate(keys[hover])}</div>
                {series.map((s) => {
                  const v = s.points[hover]?.value
                  return (
                    <div key={s.name}>
                      <span className="key" style={{ background: s.color }} />
                      <b>{v === null || v === undefined ? '—' : format(v)}</b> <span className="k">{s.name}</span>
                    </div>
                  )
                })}
              </>
            ),
          }}
        />
      )}
    </div>
  )
}

export function HBars({ items }: { items: { label: string; kept: number; total: number }[] }) {
  return (
    <div className="hbars">
      {items.map((item) => (
        <div className="hbar-row" key={item.label}>
          <span>{item.label}</span>
          <span className="val">
            {item.total ? `${item.kept}/${item.total}` : 'rest'}
          </span>
          <div className="hbar-track" aria-hidden>
            <div style={{ width: `${item.total ? (item.kept / item.total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DataTable({ rows, format, name }: { rows: Point[]; format: (v: number) => string; name: string }) {
  return (
    <details className="muted" style={{ marginTop: 6 }}>
      <summary>Table</summary>
      <table style={{ width: '100%', fontSize: 12.5, marginTop: 6, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'right' }}>{name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{shortDate(r.key)}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.value === null ? '—' : format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
