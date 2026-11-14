import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import { randomInt, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, copyFileSync, statSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeState, sanitizeState, type SyncState } from '../src/core/merge.ts'

export const HUB_PORT = 4747
const MAX_BODY_BYTES = 2 * 1024 * 1024
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const MAX_FAILURES_PER_MINUTE = 20
const MINUTE_MS = 60_000
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const LOCAL_HOST_HEADER = /^(localhost|127\.0\.0\.1)(:\d+)?$/

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
}

export interface HubOptions {
  dataDir: string
  staticDir: string
  now?: () => number
}

function newCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** Write to a temp file then rename, so a crash mid-write never leaves a half-written state file. */
function writeAtomic(path: string, data: string): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sameCode(given: string, expected: string): boolean {
  const a = Buffer.from(given.toUpperCase().replace(/[^A-Z0-9]/g, ''))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Only the Mac's own browser page may read the code: loopback address, local Host, not cross-site. */
function isLocalPage(req: IncomingMessage): boolean {
  const fetchSite = req.headers['sec-fetch-site']
  return (
    LOOPBACK.has(req.socket.remoteAddress ?? '') &&
    LOCAL_HOST_HEADER.test(req.headers.host ?? '') &&
    (fetchSite === undefined || fetchSite === 'same-origin' || fetchSite === 'none')
  )
}

export function createHub({ dataDir, staticDir, now = Date.now }: HubOptions): Server {
  mkdirSync(join(dataDir, 'backups'), { recursive: true })
  const statePath = join(dataDir, 'state.json')
  const hubPath = join(dataDir, 'hub.json')

  const saved = readJson(hubPath) as { code?: unknown } | null
  const code = typeof saved?.code === 'string' ? saved.code : newCode()
  if (saved?.code !== code) writeAtomic(hubPath, JSON.stringify({ code }))

  let state: SyncState = sanitizeState(readJson(statePath))
  const failures = new Map<string, { count: number; since: number }>()

  function persist(next: SyncState) {
    state = next
    writeAtomic(statePath, JSON.stringify(state))
    const backup = join(dataDir, 'backups', `state-${new Date(now()).toISOString().slice(0, 10)}.json`)
    if (!existsSync(backup)) copyFileSync(statePath, backup)
  }

  function tooManyFailures(ip: string): boolean {
    const entry = failures.get(ip)
    if (!entry || now() - entry.since > MINUTE_MS) return false
    return entry.count >= MAX_FAILURES_PER_MINUTE
  }

  function recordFailure(ip: string) {
    const entry = failures.get(ip)
    const fresh = !entry || now() - entry.since > MINUTE_MS
    failures.set(ip, fresh ? { count: 1, since: now() } : { count: entry.count + 1, since: entry.since })
  }

  async function handleSync(req: IncomingMessage, res: ServerResponse) {
    const ip = req.socket.remoteAddress ?? 'unknown'
    if (tooManyFailures(ip)) return send(res, 429, { error: 'Too many attempts' })
    const given = req.headers['x-wa-token']
    if (typeof given !== 'string' || !sameCode(given, code)) {
      recordFailure(ip)
      return send(res, 401, { error: 'Wrong pairing code' })
    }
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return send(res, 400, { error: 'Bad request body' })
    }
    const incoming = sanitizeState((body as { state?: unknown } | null)?.state)
    const merged = mergeState(state, incoming)
    if (JSON.stringify(merged) !== JSON.stringify(state)) persist(merged)
    return send(res, 200, { state })
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://hub')
    const root = resolve(staticDir)
    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return send(res, 400, { error: 'Bad path' })
    }
    let path = resolve(join(root, normalize(pathname)))
    if (path !== root && !path.startsWith(root + sep)) return send(res, 403, { error: 'Forbidden' })
    if (!existsSync(path) || statSync(path).isDirectory()) path = join(root, 'index.html')
    if (!existsSync(path)) return send(res, 503, { error: 'The app has not been built. Run npm run build.' })
    const isIndex = path.endsWith('index.html')
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
      'cache-control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
    res.end(readFileSync(path))
  }

  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://hub')
    const route = `${req.method} ${url.pathname}`
    if (route === 'GET /api/hello') return send(res, 200, { app: 'winter-arc', v: 1, name: hostname() })
    if (route === 'GET /api/local-token') {
      return isLocalPage(req) ? send(res, 200, { token: code }) : send(res, 403, { error: 'Local page only' })
    }
    if (route === 'POST /api/sync') {
      handleSync(req, res).catch((error) => {
        console.error('sync failed', error)
        if (!res.headersSent) send(res, 500, { error: 'Sync failed' })
      })
      return
    }
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return serveStatic(req, res)
    return send(res, 404, { error: 'Not found' })
  })
}

const BONJOUR_TYPE = '_winterarc._tcp'
const BONJOUR_RETRY_MS = 5000

/**
 * Announces the hub on the local network with macOS's own dns-sd, so the phone finds it with one
 * query instead of probing every address. The announcement lives as long as the child process.
 */
function advertise(port: number): void {
  const child = spawn('/usr/bin/dns-sd', ['-R', 'Winter Arc', BONJOUR_TYPE, 'local', String(port)], { stdio: 'ignore' })
  child.on('error', (error) => console.error('Bonjour announcement failed; the phone will fall back to scanning', error))
  child.on('exit', () => setTimeout(() => advertise(port), BONJOUR_RETRY_MS).unref())
  process.on('exit', () => child.kill())
}

function main() {
  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const dataDir = process.env.WA_DATA_DIR ?? join(homedir(), 'Library', 'Application Support', 'WinterArc')
  const staticDir = process.env.WA_STATIC_DIR ?? join(repoRoot, 'dist')
  const port = Number(process.env.WA_PORT ?? HUB_PORT)
  const hub = createHub({ dataDir, staticDir })
  hub.listen(port, '0.0.0.0', () => {
    console.log(`Winter Arc hub on http://localhost:${port} · data in ${dataDir}`)
    advertise(port)
  })
}

if (import.meta.main) main()
