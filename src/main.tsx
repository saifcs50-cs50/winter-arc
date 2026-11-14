import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/scheherazade-new/arabic-400.css'
import '@fontsource/scheherazade-new/arabic-700.css'
import './ui/styles.css'
import { createStore } from './core/store.ts'
import { isNative } from './platform/native.ts'
import { lanHubTransport, localHubTransport } from './platform/transports.ts'
import { App } from './ui/App.tsx'

function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const platform = isNative ? 'phone' : 'mac'
const store = createStore({ storage: browserStorage(), devicePrefix: platform })
const transport = isNative ? lanHubTransport() : localHubTransport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} transport={transport} platform={platform} />
  </StrictMode>,
)
