import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// The app promises that photos never leave the browser. The Content Security
// Policy served by Vercel (and mirrored by `vite preview`) enforces that; these
// checks keep it from being loosened by accident.
interface VercelConfig {
  headers?: { source: string; headers: { key: string; value: string }[] }[]
}

const config: VercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'))
const rule = config.headers?.find(entry => entry.source === '/(.*)')
const header = (key: string) => rule?.headers.find(h => h.key === key)?.value ?? ''
const csp = Object.fromEntries(
  header('Content-Security-Policy')
    .split(';')
    .map(directive => directive.trim().split(/\s+/))
    .filter(parts => parts[0])
    .map(([name, ...sources]) => [name, sources])
)

describe('security headers (vercel.json)', () => {
  it('apply to every path', () => {
    expect(rule).toBeDefined()
  })

  it('only let scripts, workers and requests reach this origin', () => {
    expect(csp['default-src']).toEqual(["'self'"])
    expect(csp['script-src']).toEqual(["'self'"])
    expect(csp['worker-src']).toEqual(["'self'"])
    expect(csp['connect-src']).toEqual(["'self'"])
    expect(csp['object-src']).toEqual(["'none'"])
  })

  it('keep other sites from framing the app', () => {
    expect(csp['frame-ancestors']).toEqual(["'none'"])
    expect(header('X-Frame-Options')).toBe('DENY')
  })

  it('send no referrer and no MIME sniffing', () => {
    expect(header('Referrer-Policy')).toBe('no-referrer')
    expect(header('X-Content-Type-Options')).toBe('nosniff')
  })
})
