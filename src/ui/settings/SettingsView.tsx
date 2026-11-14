import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ASR_MADHAB, PRAYER_LOCATION, PRAYER_METHOD, SOCIAL_APPS } from '../../core/config.ts'
import { planNight } from '../../core/night.ts'
import { scheduledMessage } from '../../core/reminders.ts'
import { formatTime12, PRAYERS, prayerTimes } from '../../core/prayer.ts'
import { BONUS_CHOICES, isWakeTime, type RuleId } from '../../core/rules.ts'
import { Native } from '../../platform/native.ts'
import { loadPairing, normalizeCode, savePairing } from '../../platform/transports.ts'
import { scheduleReminders } from '../../platform/phone.ts'
import { useApp } from '../AppContext.tsx'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CODE_LENGTH = 8

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

function MacPairing() {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/local-token')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`))))
      .then((body: { token?: string }) => setCode(body.token ?? null))
      .catch(() => setError('The hub is not running, so there is no code to show.'))
  }, [])
  return (
    <div className="card setting">
      <h3>Pair your phone</h3>
      <p>In the phone app, open Settings and type this code. The phone and this Mac must be on the same Wi-Fi, or this Mac on your phone's hotspot.</p>
      {code ? <div className="code-display">{formatCode(code)}</div> : <p className="muted">{error ?? 'Loading…'}</p>}
    </div>
  )
}

function PhonePairing() {
  const { syncNow, status } = useApp()
  const [pairing, setPairing] = useState(loadPairing())
  const [input, setInput] = useState('')
  const valid = normalizeCode(input).length === CODE_LENGTH

  function save() {
    const next = { code: normalizeCode(input) }
    savePairing(next)
    setPairing(next)
    setInput('')
    syncNow()
  }

  return (
    <div className="card setting">
      <h3>Pair with your Mac</h3>
      <p>Open Winter Arc on the Mac, go to Settings and type the 8-letter code here. Sync works on the same Wi-Fi, or with the Mac on this phone's hotspot.</p>
      {pairing && (
        <div className="status-line" style={{ marginBottom: 10 }}>
          Paired · code {formatCode(pairing.code)}
          {pairing.host ? ` · Mac at ${pairing.host}` : ''}
        </div>
      )}
      <div className="inline-form">
        <input
          className="text-input"
          placeholder="ABCD-EFGH"
          autoCapitalize="characters"
          autoCorrect="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Pairing code"
        />
        <button className="pill-btn primary" disabled={!valid} onClick={save}>
          {pairing ? 'Update' : 'Pair'}
        </button>
      </div>
      {'message' in status && <p className="muted" style={{ marginTop: 8 }}>{status.message}</p>}
    </div>
  )
}

function PhoneAccess() {
  const { today, settings } = useApp()
  const [usage, setUsage] = useState<boolean | null>(null)
  const [alarms, setAlarms] = useState<{ exact: boolean; fullScreen: boolean } | null>(null)
  const [reminders, setReminders] = useState<string>('')

  useEffect(() => {
    const refresh = () => {
      Native.usageAccess().then((r) => setUsage(r.granted)).catch(() => setUsage(false))
      Native.alarmStatus().then(setAlarms).catch(() => setAlarms(null))
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  async function reschedule() {
    setReminders('Scheduling…')
    try {
      const result = await scheduleReminders(today, new Date(), settings)
      setReminders(result === 'ok' ? scheduledMessage(settings) : 'Notifications are blocked. Allow them in Android settings.')
    } catch (error) {
      setReminders(`Could not schedule: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <>
      <div className="card setting">
        <h3>Screen time access</h3>
        <p>Lets the app read how long social apps were open today. Nothing leaves your phone except the daily total, which goes to your Mac.</p>
        <div className="status-line">
          <span className={`sync-dot ${usage ? 'ok' : 'warn'}`} /> {usage === null ? 'Checking…' : usage ? 'Allowed' : 'Not allowed yet'}
        </div>
        {!usage && (
          <button className="pill-btn primary" style={{ marginTop: 10 }} onClick={() => void Native.openUsageSettings()}>
            Allow usage access
          </button>
        )}
      </div>
      <div className="card setting">
        <h3>{settings.edition === 'deen' ? 'Reminders and Tahajjud alarm' : 'Reminders and wake-up alarm'}</h3>
        <p>
          {settings.edition === 'deen'
            ? 'Prayer times, screens off, lights out and "tick your day". Tahajjud rings like an alarm clock, 30 minutes before Fajr.'
            : 'Screens off, lights out and "tick your day". The wake-up alarm rings like an alarm clock.'}
        </p>
        {alarms && (
          <div className="status-line">
            <span className={`sync-dot ${alarms.exact && alarms.fullScreen ? 'ok' : 'warn'}`} />
            {alarms.exact ? 'Exact alarms allowed' : 'Exact alarms blocked'} · {alarms.fullScreen ? 'full-screen alarm allowed' : 'full-screen alarm blocked'}
          </div>
        )}
        <button className="pill-btn primary" style={{ marginTop: 10 }} onClick={() => void reschedule()}>
          <RefreshCw size={14} />
          Reschedule now
        </button>
        {reminders && <p className="muted" style={{ marginTop: 8 }}>{reminders}</p>}
      </div>
    </>
  )
}

function WakeSettings() {
  const { settings, setSetting, today } = useApp()
  const night = planNight(today, settings)
  return (
    <div className="card setting">
      <h3>Wake-up time</h3>
      <p>Lights-out is worked back from this so you always get 7 hours. Tonight: screens off {formatTime12(night.screensOff)}, lights out {formatTime12(night.lightsOut)}.</p>
      <div className="log-row">
        <input
          className="num-input"
          style={{ width: 130 }}
          type="time"
          aria-label="Wake-up time"
          value={settings.wakeTime}
          onChange={(e) => isWakeTime(e.target.value) && setSetting('wakeTime', e.target.value)}
        />
        <button className={`toggle ${settings.wakeAlarm ? 'on' : ''}`} aria-pressed={settings.wakeAlarm} onClick={() => setSetting('wakeAlarm', !settings.wakeAlarm)}>
          {settings.wakeAlarm ? 'Alarm on' : 'Alarm off'}
        </button>
      </div>
    </div>
  )
}

function BonusPicker() {
  const { settings, setSetting } = useApp()
  const chosen: readonly RuleId[] = settings.bonusRules ?? BONUS_CHOICES.map((r) => r.id)
  function toggle(id: RuleId) {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
    setSetting('bonusRules', BONUS_CHOICES.map((r) => r.id).filter((x) => next.includes(x)))
  }
  return (
    <div className="card setting">
      <h3>Your bonus goals</h3>
      <p>Pick the ones you want. Each one you tick makes the day greener. The core 5 always stay on and decide whether a day counts.</p>
      <div className="stack">
        {BONUS_CHOICES.map((rule) => (
          <button key={rule.id} className="app-toggle" style={{ textAlign: 'left', padding: '0 14px' }} aria-pressed={chosen.includes(rule.id)} onClick={() => toggle(rule.id)}>
            {rule.title}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsView() {
  const { platform, settings, setSetting, today } = useApp()
  const times = prayerTimes(today)
  const deen = settings.edition === 'deen'

  function toggleDay(d: number) {
    const next = settings.workoutDays.includes(d) ? settings.workoutDays.filter((x) => x !== d) : [...settings.workoutDays, d].sort((a, b) => a - b)
    setSetting('workoutDays', next)
  }

  function toggleApp(id: string) {
    const next = settings.socialApps.includes(id) ? settings.socialApps.filter((x) => x !== id) : [...settings.socialApps, id]
    setSetting('socialApps', next)
  }

  return (
    <div className="page">
      <div className="settings-list">
        {platform === 'mac' ? <MacPairing /> : <PhonePairing />}

        {!deen && <WakeSettings />}
        {!deen && <BonusPicker />}

        <div className="card setting">
          <h3>Workout days</h3>
          <p>
            {deen
              ? 'Your plan runs Lower A, Upper A, Lower B, Upper B in that order across these days. The other days are rest.'
              : 'The workout rule only applies on these days. The other days count as rest.'}
          </p>
          <div className="day-toggles">
            {DAY_NAMES.map((name, d) => (
              <button key={name} aria-pressed={settings.workoutDays.includes(d)} onClick={() => toggleDay(d)}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="card setting">
          <h3>Apps that count as social media</h3>
          <p>Their time adds up toward the 60-minute limit. If you watch lectures on YouTube, you can switch it off here.</p>
          <div className="app-toggles">
            {SOCIAL_APPS.map((app) => (
              <button key={app.id} className="app-toggle" aria-pressed={settings.socialApps.includes(app.id)} onClick={() => toggleApp(app.id)}>
                {app.name}
              </button>
            ))}
          </div>
        </div>

        {platform === 'phone' && <PhoneAccess />}

        {deen && (
        <div className="card setting">
          <h3>Prayer times</h3>
          <p>
            {PRAYER_LOCATION.name} · {PRAYER_METHOD} method · {ASR_MADHAB === 'Shafi' ? "Shafi'i" : 'Hanafi'} Asr. Worked out on the device, no internet needed.
          </p>
          <div className="prayer-strip">
            {PRAYERS.map((p) => (
              <div key={p.id}>
                <div className="name">{p.name}</div>
                <div className="time">{formatTime12(times[p.id]).replace(/ (AM|PM)/, '')}</div>
              </div>
            ))}
          </div>
        </div>
        )}

        {deen && (
          <p className="muted" style={{ textAlign: 'center' }}>
            Adhkar: Hisn al-Muslim, chapter 27. Qur'an text: Tanzil (Uthmani).
          </p>
        )}
      </div>
    </div>
  )
}
