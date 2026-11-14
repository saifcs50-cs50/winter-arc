import type { CapacitorConfig } from '@capacitor/cli'

const APP_BACKGROUND = '#0a1020'

const config: CapacitorConfig = {
  appId: 'com.saif.winterarc',
  appName: 'Winter Arc',
  webDir: 'dist-android',
  backgroundColor: APP_BACKGROUND,
  plugins: {
    SystemBars: { style: 'DARK' },
    LocalNotifications: { smallIcon: 'ic_stat_arc', iconColor: '#8fd3ff' },
  },
}

export default config
