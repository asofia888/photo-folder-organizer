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
  // One manual per UI language (see MANUAL_PATHS in ManualModal).
  it.each(['MANUAL.md', 'MANUAL.en.md'])('public/%s exists and is non-empty', (fileName) => {
    const manualPath = path.join(projectRoot, 'public', fileName)
    expect(fs.existsSync(manualPath)).toBe(true)
    expect(fs.statSync(manualPath).size).toBeGreaterThan(0)
  })
})
