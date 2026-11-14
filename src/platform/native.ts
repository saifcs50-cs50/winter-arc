import { Capacitor, registerPlugin } from '@capacitor/core'

export interface NativeAlarm {
  id: number
  at: number
  title: string
  body: string
}

/** The app's own Android plugin (android/app/src/main/java/com/saif/winterarc/WinterArcPlugin.java). */
export interface WinterArcNative {
  usageAccess(): Promise<{ granted: boolean }>
  openUsageSettings(): Promise<void>
  socialMinutes(options: { from: number; to: number; packages: string[] }): Promise<{ minutes: number; perApp: Record<string, number> }>
  findHub(options: { port: number; lastHost?: string }): Promise<{ host: string }>
  scheduleAlarms(options: { alarms: NativeAlarm[] }): Promise<{ scheduled: number }>
  alarmStatus(): Promise<{ exact: boolean; fullScreen: boolean }>
  openApp(options: { packageName: string }): Promise<{ opened: boolean }>
}

export const Native = registerPlugin<WinterArcNative>('WinterArc')

export const isNative = Capacitor.isNativePlatform()
