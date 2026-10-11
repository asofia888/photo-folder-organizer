import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// vitest runs with the project root as cwd; import.meta.url is not usable
// here because the jsdom environment rewrites it to an http:// URL.
const projectRoot = process.cwd()

// ManualModal fetches /MANUAL.md at runtime, and only files inside public/
// are copied into the production build. When the manual lived outside
// public/, the Vercel SPA rewrite served index.html for it with a 200 and the
// modal rendered garbage in production — while working fine in dev.
describe('static assets served at runtime', () => {
  it('public/MANUAL.md exists and is non-empty', () => {
    const manualPath = path.join(projectRoot, 'public', 'MANUAL.md')
    expect(fs.existsSync(manualPath)).toBe(true)
    expect(fs.statSync(manualPath).size).toBeGreaterThan(0)
  })
})
