import { arcDayNumber, ARC_DAYS, ARC_START, daysBetween, phaseOf } from '../core/dates.ts'
import type { SyncStatus } from '../core/sync.ts'
import { useApp } from './AppContext.tsx'

function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`
}

function syncLabel(status: SyncStatus, peer: string): { text: string; tone: string } {
  switch (status.kind) {
    case 'syncing':
      return { text: 'Syncing', tone: 'busy' }
    case 'ok':
      return { text: `Synced ${ago(status.at)}`, tone: 'ok' }
    case 'offline':
      return { text: status.lastOk ? `${peer} offline · ${ago(status.lastOk)}` : `${peer} not found`, tone: 'warn' }
    case 'unpaired':
      return { text: 'Not paired', tone: 'warn' }
    case 'error':
      return { text: 'Sync error', tone: 'warn' }
    default:
      return { text: 'Starting', tone: '' }
  }
}

export function Header() {
  const { today, status, platform, syncNow } = useApp()
  const day = arcDayNumber(today)
  const sync = syncLabel(status, platform === 'phone' ? 'Mac' : 'Hub')
  let line
  if (day) {
    line = (
      <>
        Day {day} <small>of {ARC_DAYS} · {phaseOf(day)}</small>
      </>
    )
  } else if (today < ARC_START) {
    const left = daysBetween(today, ARC_START)
    line = (
      <>
        Starts in {left} {left === 1 ? 'day' : 'days'}
      </>
    )
  } else {
    line = <>Arc complete</>
  }
  return (
    <header className="header">
      <div className="header-row">
        <div>
          <div className="brand">WINTER ARC</div>
          <div className="day-line">{line}</div>
        </div>
        <button className="sync-chip" onClick={syncNow} title={'message' in status ? status.message : 'Sync now'}>
          <span className={`sync-dot ${sync.tone}`} aria-hidden />
          {sync.text}
        </button>
      </div>
    </header>
  )
}
