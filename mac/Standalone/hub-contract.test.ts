// @vitest-environment node
// Runs the Node hub's contract against the Swift hub inside the standalone Mac app.
// Build it (mac/build-standalone.sh --test-binary prints the path) and run with SWIFT_HUB_BIN=<path>.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BIN = process.env.SWIFT_HUB_BIN
const PORT = 47_900 + Math.floor(Math.random() * 90)

let dir = ''
let hub: ChildProcess | null = null

function call(method: string, path: string, opts: { headers?: Record<string, string>; body?: unknown } = {}) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, method, path, headers: opts.headers }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    if (opts.body !== undefined) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body))
    req.end()
  })
}

async function localCode(): Promise<string> {
  const res = await call('GET', '/api/local-token', { headers: { host: `localhost:${PORT}` } })
  return JSON.parse(res.body).token
}

describe.skipIf(!BIN)('Swift hub contract', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'wa-swift-hub-'))
    mkdirSync(join(dir, 'static'))
    writeFileSync(join(dir, 'static', 'index.html'), '<h1>Winter Arc</h1>')
    writeFileSync(join(dir, 'secret.txt'), 'nope')
    hub = spawn(BIN!, ['--hub-only'], {
      env: { ...process.env, WA_PORT: String(PORT), WA_DATA_DIR: join(dir, 'data'), WA_STATIC_DIR: join(dir, 'static') },
    })
    await new Promise<void>((resolve, reject) => {
      hub!.stdout!.on('data', (d) => String(d).includes('ready') && resolve())
      hub!.on('exit', (code) => reject(new Error(`hub exited ${code}`)))
    })
  })

  afterAll(() => {
    hub?.kill()
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  test('answers discovery probes without a code', async () => {
    expect(JSON.parse((await call('GET', '/api/hello')).body)).toMatchObject({ app: 'winter-arc', v: 1 })
  })

  test('gives the pairing code only to the Mac page itself', async () => {
    expect((await call('GET', '/api/local-token', { headers: { host: `evil.example:${PORT}` } })).status).toBe(403)
    expect((await call('GET', '/api/local-token', { headers: { host: `localhost:${PORT}`, 'sec-fetch-site': 'cross-site' } })).status).toBe(403)
    expect(await localCode()).toMatch(/^[A-Z2-9]{8}$/)
  })

  test('merges, persists and returns state for a correct code, in any case or with a dash', async () => {
    const code = await localCode()
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`
    const phone = { 'day/2026-10-01': { 'r.sleep': { v: true, t: 1790700588869, d: 'phone-a' }, weight: { v: 80.4, t: 5, d: 'phone-a' } } }
    const res = await call('POST', '/api/sync', { headers: { 'x-wa-token': typed }, body: { state: phone } })
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body).state).toEqual(phone)
    expect(JSON.parse(readFileSync(join(dir, 'data', 'state.json'), 'utf8'))).toEqual(phone)
    expect(existsSync(join(dir, 'data', 'backups'))).toBe(true)
  })

  test('keeps the newest write per field, and ties go to the larger device id', async () => {
    const code = await localCode()
    const older = { 'day/2026-10-01': { 'r.sleep': { v: false, t: 1, d: 'mac-z' } } }
    const tie = { 'day/2026-10-01': { weight: { v: 85, t: 5, d: 'phone-b' } } }
    await call('POST', '/api/sync', { headers: { 'x-wa-token': code }, body: { state: older } })
    const res = await call('POST', '/api/sync', { headers: { 'x-wa-token': code }, body: { state: tie } })
    const day = JSON.parse(res.body).state['day/2026-10-01']
    expect(day['r.sleep'].v).toBe(true)
    expect(day.weight).toEqual({ v: 85, t: 5, d: 'phone-b' })
  })

  test('drops malformed state and rejects a broken body', async () => {
    const code = await localCode()
    const bad = { '../x': { a: { v: 1, t: 1, d: 'x' } }, ok: { f: { v: { nested: true }, t: 1, d: 'x' }, g: { v: 1, t: true, d: 'x' } } }
    const res = await call('POST', '/api/sync', { headers: { 'x-wa-token': code }, body: { state: bad } })
    expect(Object.keys(JSON.parse(res.body).state)).toEqual(['day/2026-10-01'])
    expect((await call('POST', '/api/sync', { headers: { 'x-wa-token': code }, body: '{broken' })).status).toBe(400)
  })

  test('serves the app, falls back to index.html, never leaves the folder, and survives bad escapes', async () => {
    expect((await call('GET', '/')).body).toContain('Winter Arc')
    expect((await call('GET', '/review')).body).toContain('Winter Arc')
    expect((await call('GET', '/..%2Fsecret.txt')).body).not.toContain('nope')
    expect((await call('GET', '/%E0%A4%A')).status).toBe(400)
    expect((await call('GET', '/api/hello')).status).toBe(200)
  })

  test('rejects a wrong code and rate-limits repeated guesses', async () => {
    const wrong = { headers: { 'x-wa-token': 'AAAAAAAA' }, body: { state: {} } }
    expect((await call('POST', '/api/sync', wrong)).status).toBe(401)
    for (let i = 0; i < 20; i++) await call('POST', '/api/sync', wrong)
    expect((await call('POST', '/api/sync', { ...wrong, headers: { 'x-wa-token': await localCode() } })).status).toBe(429)
  })
})
