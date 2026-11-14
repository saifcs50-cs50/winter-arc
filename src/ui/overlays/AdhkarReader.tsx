import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import adhkar from '../../data/adhkar.json'
import type { DateKey } from '../../core/dates.ts'
import { useApp } from '../AppContext.tsx'

interface Surah {
  name: string
  bismillah: string | null
  verses: string[]
}

interface Dhikr {
  id: string
  kind: 'quran' | 'dua'
  title: string
  reference: string
  repeat: number
  arabic?: string
  preface?: string | null
  surahs?: Surah[]
  meaning: string
}

const SETS = adhkar as unknown as Record<'morning' | 'evening', { minutes: number; items: Dhikr[] }>

function vibrate() {
  try {
    navigator.vibrate?.(12)
  } catch {
    // Vibration is a nicety; some WebViews block it.
  }
}

/**
 * Tanzil writes waqf signs (ۖ ۗ ۚ …) after a space, so a line break can strand one at the start of
 * the next line. Attaching each to the end of the previous word keeps it with its word.
 * Only whitespace changes; every letter and mark stays as sourced.
 */
export function attachWaqfMarks(verse: string): string {
  return verse.replace(/ ([\u06D6-\u06DC])/g, '$1')
}

function QuranText({ item }: { item: Dhikr }) {
  return (
    <div className="quran" lang="ar">
      {item.preface && <span className="preface">{item.preface}</span>}
      {item.surahs?.map((s) => (
        <div key={s.name}>
          {item.surahs!.length > 1 && <span className="surah-name">{s.name}</span>}
          {s.bismillah && <span className="bismillah">{s.bismillah}</span>}
          {s.verses.map((v, i) => (
            <span key={i}>
              {attachWaqfMarks(v)}
              {s.verses.length > 1 && <span className="ayah-end">۝</span>}{' '}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function DhikrCard({ item, count, active, onTap }: { item: Dhikr; count: number; active: boolean; onTap: () => void }) {
  const [showMeaning, setShowMeaning] = useState(false)
  const complete = count >= item.repeat
  return (
    <article className={`dhikr ${active ? 'active' : ''} ${complete ? 'complete' : ''}`} data-id={item.id}>
      <div className="dhikr-top">
        <b>{item.title}</b>
        <span>{item.reference}</span>
      </div>
      {item.kind === 'quran' ? (
        <QuranText item={item} />
      ) : (
        <p className="arabic" lang="ar" style={{ margin: 0 }}>
          {item.arabic}
        </p>
      )}
      <button className="link-btn" style={{ fontSize: 13 }} onClick={() => setShowMeaning(!showMeaning)} aria-expanded={showMeaning}>
        {showMeaning ? 'Hide meaning' : 'Meaning'}
      </button>
      {showMeaning && <p className="meaning">{item.meaning}</p>}
      <button className="counter-btn" onClick={onTap} disabled={complete} aria-label={`${item.title}: ${Math.min(count, item.repeat)} of ${item.repeat}`}>
        {complete ? <Check size={18} strokeWidth={3} /> : null}
        {item.repeat === 1 ? (complete ? 'Done' : 'Tap when read') : `${Math.min(count, item.repeat)} / ${item.repeat}`}
      </button>
    </article>
  )
}

export function AdhkarReader({ which, day, onClose }: { which: 'morning' | 'evening'; day: DateKey; onClose: () => void }) {
  const { setDay } = useApp()
  const set = SETS[which]
  const [counts, setCounts] = useState<Record<string, number>>({})
  const bodyRef = useRef<HTMLDivElement>(null)
  const doneCount = set.items.filter((i) => (counts[i.id] ?? 0) >= i.repeat).length
  const activeIndex = set.items.findIndex((i) => (counts[i.id] ?? 0) < i.repeat)
  const finished = activeIndex === -1

  useEffect(() => {
    if (finished) setDay(day, which === 'morning' ? 'r.adhkarAm' : 'r.adhkarPm', true)
  }, [finished, day, which, setDay])

  function tap(item: Dhikr, index: number) {
    vibrate()
    const next = Math.min(item.repeat, (counts[item.id] ?? 0) + 1)
    setCounts({ ...counts, [item.id]: next })
    if (next >= item.repeat) {
      const following = set.items[index + 1]
      const el = following && bodyRef.current?.querySelector(`[data-id="${following.id}"]`)
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250)
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`${which} adhkar`}>
      <div className="overlay-head">
        <div>
          <h2>{which === 'morning' ? 'Morning adhkar' : 'Evening adhkar'}</h2>
          <div className="muted">
            About {set.minutes} min · {doneCount} of {set.items.length} done
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="overlay-body" ref={bodyRef}>
        <div className="overlay-inner">
          {set.items.map((item, index) => (
            <DhikrCard key={item.id} item={item} count={counts[item.id] ?? 0} active={index === activeIndex} onTap={() => tap(item, index)} />
          ))}
          {finished && (
            <div className="banner info" style={{ marginBottom: 24 }}>
              <Check className="banner-icon" size={18} />
              <div>
                <strong>Complete. Marked done for today.</strong>
                <button className="link-btn" onClick={onClose}>
                  Back to today
                </button>
              </div>
            </div>
          )}
          <p className="muted" style={{ textAlign: 'center', marginBottom: 24 }}>
            Hisn al-Muslim, chapter 27 · Qur'an text: Tanzil (Uthmani)
          </p>
        </div>
      </div>
    </div>
  )
}
