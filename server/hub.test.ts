// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { request } from 'node:http'
import { createHub } from './hub.ts'

let dir: string
let hub: Server
let port: number

function call(method: string, path: string, opts: { headers?: Record<string, string>; body?: unknown } = {}) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: opts.headers }, (res) => {
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
  const res = await call('GET', '/api/local-token', { headers: { host: `localhost:${port}` } })
  return JSON.parse(res.body).token
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'wa-hub-'))
  mkdirSync(join(dir, 'static'))
  writeFileSync(join(dir, 'static', 'index.html'), '<h1>Winter Arc</h1>')
  writeFileSync(join(dir, 'secret.txt'), 'nope')
  hub = createHub({ dataDir: join(dir, 'data'), staticDir: join(dir, 'static'), now: () => Date.UTC(2026, 9, 1) })
  await new Promise<void>((r) => hub.listen(0, '127.0.0.1', r))
  port = (hub.address() as AddressInfo).port
})

afterEach(async () => {
  await new Promise((r) => hub.close(r))
  rmSync(dir, { recursive: true, force: true })
})

describe('hub', () => {
  test('answers discovery probes without a code', async () => {
    const res = await call('GET', '/api/hello')
    expect(JSON.parse(res.body)).toMatchObject({ app: 'winter-arc', v: 1 })
  })

  test('gives the pairing code only to the Mac page itself', async () => {
    expect((await call('GET', '/api/local-token', { headers: { host: `localhost:${port}` } })).status).toBe(200)
    expect((await call('GET', '/api/local-token', { headers: { host: `evil.example:${port}` } })).status).toBe(403)
    expect((await call('GET', '/api/local-token', { headers: { host: `localhost:${port}`, 'sec-fetch-site': 'cross-site' } })).status).toBe(403)
    expect(await localCode()).toMatch(/^[A-Z2-9]{8}$/)
  })

  test('merges, persists and returns state for a correct code, in any case or with a dash', async () => {
    const code = await localCode()
    const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`
    const phoneState = { 'day/2026-10-01': { 'r.sleep': { v: true, t: 5, d: 'phone-a' } } }
    const res = await call('POST', '/api/sync', { headers: { 'x-wa-token': typed, 'content-type': 'application/json' }, body: { state: phoneState } })
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body).state).toEqual(phoneState)
    expect(JSON.parse(readFileSync(join(dir, 'data', 'state.json'), 'utf8'))).toEqual(phoneState)
    expect(JSON.parse(readFileSync(join(dir, 'data', 'backups', 'state-2026-10-01.json'), 'utf8'))).toEqual(phoneState)
  })

  test('keeps the same code across restarts', async () => {
    const code = await localCode()
    const again = createHub({ dataDir: join(dir, 'data'), staticDir: join(dir, 'static') })
    await new Promise<void>((r) => again.listen(0, '127.0.0.1', r))
    const res = await new Promise<string>((resolve) => {
      request({ host: '127.0.0.1', port: (again.address() as AddressInfo).port, path: '/api/local-token', headers: { host: 'localhost' } }, (r) => {
        let b = ''
        r.on('data', (c) => (b += c))
        r.on('end', () => resolve(b))
      }).end()
    })
    await new Promise((r) => again.close(r))
    expect(JSON.parse(res).token).toBe(code)
  })

  test('rejects a wrong code and rate-limits repeated guesses', async () => {
    const wrong = { headers: { 'x-wa-token': 'AAAAAAAA' }, body: { state: {} } }
    expect((await call('POST', '/api/sync', wrong)).status).toBe(401)
    for (let i = 0; i < 20; i++) await call('POST', '/api/sync', wrong)
    expect((await call('POST', '/api/sync', { ...wrong, headers: { 'x-wa-token': await localCode() } })).status).toBe(429)
  })

  test('drops malformed state instead of storing it', async () => {
    const code = await localCode()
    const res = await call('POST', '/api/sync', { headers: { 'x-wa-token': code }, body: { state: { '../x': { a: { v: 1, t: 1, d: 'x' } }, ok: { f: { v: { nested: true }, t: 1, d: 'x' } } } } })
    expect(JSON.parse(res.body).state).toEqual({})
    expect((await call('POST', '/api/sync', { headers: { 'x-wa-token': code }, body: '{broken' })).status).toBe(400)
  })

  test('serves the app, falls back to index.html, and never leaves the static folder', async () => {
    expect((await call('GET', '/')).body).toContain('Winter Arc')
    expect((await call('GET', '/review')).body).toContain('Winter Arc')
    const escape = await call('GET', '/..%2Fsecret.txt')
    expect(escape.body).not.toContain('nope')
  })
})

test('a malformed URL escape is a 400, not a crash', async () => {
  expect((await call('GET', '/%E0%A4%A')).status).toBe(400)
  expect((await call('GET', '/api/hello')).status).toBe(200)
})
