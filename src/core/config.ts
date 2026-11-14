/**
 * Fixed choices. Only workout days and social apps live in synced settings.
 * Prayer times are worked out for this place; the default is Mecca. Put your own city's name and
 * coordinates here (times show in the device's time zone). The calculation method and Asr rule are set in prayer.ts.
 */
export const PRAYER_LOCATION = { name: 'Mecca', latitude: 21.4225, longitude: 39.8262 } as const
export const PRAYER_METHOD = 'Karachi' as const
export const ASR_MADHAB = 'Shafi' as const

export const SLEEP_HOURS = 7
export const TAHAJJUD_BEFORE_FAJR_MIN = 30
export const SCREENS_OFF_BEFORE_LIGHTS_OUT_MIN = 60
export const TICK_REMINDER_BEFORE_SCREENS_OFF_MIN = 10
export const LIGHTS_OUT_ROUND_MIN = 5

export const STUDY_TARGET_HOURS = 3
export const SOCIAL_LIMIT_MIN = 60
export const ISTIGHFAR_TARGET = 100

export const HUB_PORT = 4747

export interface SocialApp {
  id: string
  name: string
}

/** Social apps counted toward the 60-minute limit. Messaging apps are listed but off by default. */
export const SOCIAL_APPS: readonly SocialApp[] = [
  { id: 'com.instagram.android', name: 'Instagram' },
  { id: 'com.google.android.youtube', name: 'YouTube' },
  { id: 'com.snapchat.android', name: 'Snapchat' },
  { id: 'com.pinterest', name: 'Pinterest' },
  { id: 'com.linkedin.android', name: 'LinkedIn' },
  { id: 'com.facebook.katana', name: 'Facebook' },
  { id: 'com.twitter.android', name: 'X' },
  { id: 'com.instagram.barcelona', name: 'Threads' },
  { id: 'com.reddit.frontpage', name: 'Reddit' },
  { id: 'com.whatsapp', name: 'WhatsApp' },
  { id: 'org.telegram.messenger', name: 'Telegram' },
]

export const DEFAULT_SOCIAL_APP_IDS: readonly string[] = SOCIAL_APPS.filter(
  (app) => app.id !== 'com.whatsapp' && app.id !== 'org.telegram.messenger',
).map((app) => app.id)

/** Standard edition's starting workout days (Mon, Tue, Wed, Fri, Sat) until the user picks their own. */
export const DEFAULT_WORKOUT_DAYS: readonly number[] = [1, 2, 3, 5, 6]

export const QURANLY_PACKAGE = 'com.quranly.app'

/** Standard edition's starting wake-up time; the user changes it in Settings. */
export const DEFAULT_WAKE_TIME = '05:30'
