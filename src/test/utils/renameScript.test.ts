import { describe, it, expect, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRenameScript, quoteBatch, quotePosix } from '../../../utils/renameScript'

describe('POSIX rename script', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('quotes names so the shell never expands them', () => {
    expect(quotePosix(`it's $(x) \`y\``)).toBe(`'it'\\''s $(x) \`y\`'`)
  })

  // Runs the generated script with the real shell against real folders.
  it.skipIf(process.platform === 'win32')('renames hostile folder names safely and never nests duplicates', () => {
    dir = mkdtempSync(join(tmpdir(), 'rename-script-'))
    const hostile = 'trip $(touch PWNED) `touch PWNED2`'
    const quoted = `it's "quoted" & 100%`
    for (const name of [hostile, quoted, 'A', 'B']) {
      mkdirSync(join(dir, name))
    }

    const { content, filename } = createRenameScript(
      [
        { from: hostile, to: '2024-06-15_$(touch PWNED3)' },
        { from: quoted, to: `2024-06-16_it's fine & 100%` },
        { from: 'A', to: '2024-06-17_Same' },
        { from: 'B', to: '2024-06-17_Same' },
        { from: 'missing', to: '2024-06-18_Gone' },
      ],
      'posix'
    )
    expect(filename).toBe('rename_folders.sh')
    writeFileSync(join(dir, filename), content)

    // Run from a different working directory: the script must cd to itself.
    const output = execFileSync('sh', [join(dir, filename)], { cwd: tmpdir(), encoding: 'utf8' })

    const entries = readdirSync(dir)
    expect(entries).toContain('2024-06-15_$(touch PWNED3)')
    expect(entries).toContain(`2024-06-16_it's fine & 100%`)
    expect(entries).toContain('2024-06-17_Same')
    // The second folder with the same target is left alone, not moved inside.
    expect(entries).toContain('B')
    expect(existsSync(join(dir, '2024-06-17_Same', 'B'))).toBe(false)
    // Nothing embedded in a name was executed.
    for (const marker of ['PWNED', 'PWNED2', 'PWNED3']) {
      expect(existsSync(join(dir, marker))).toBe(false)
      expect(existsSync(join(tmpdir(), marker))).toBe(false)
    }
    expect(output).toContain('Skipped (already exists): 2024-06-17_Same')
    expect(output).toContain('Skipped (not found): missing')
  })

  it('refuses a target name that is not a valid folder name', () => {
    const { content } = createRenameScript([{ from: 'A', to: '2024-06-15_a/b' }], 'posix')
    expect(content).not.toContain('rename_folder \'A\'')
    expect(content).toContain('Skipped (invalid new name): A')
  })
})

describe('Windows rename script', () => {
  it('doubles percent signs so cmd does not expand variables', () => {
    expect(quoteBatch('100%PATH%')).toBe('"100%%PATH%%"')
  })

  it('skips existing targets instead of overwriting and uses CRLF line endings', () => {
    const { content, filename } = createRenameScript([{ from: 'A & B', to: '2024-06-15_夏休み' }], 'windows')
    expect(filename).toBe('rename_folders.bat')
    expect(content).toContain('chcp 65001')
    expect(content).toContain('if not exist "A & B" echo Skipped (not found): "A & B"')
    expect(content).toContain('if exist "A & B" if exist "2024-06-15_夏休み" echo Skipped (already exists): "2024-06-15_夏休み"')
    expect(content).toContain('if exist "A & B" if not exist "2024-06-15_夏休み" ren "A & B" "2024-06-15_夏休み"')
    expect(content.split('\r\n').length).toBeGreaterThan(5)
    expect(content.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('skips names that cannot be quoted for cmd', () => {
    const { content } = createRenameScript(
      [
        { from: 'say "hi"', to: '2024-06-15_ok' },
        { from: 'A', to: '2024-06-15_bad|name' },
      ],
      'windows'
    )
    expect(content).not.toContain(' ren ')
    expect(content.match(/Skipped one folder/g)).toHaveLength(2)
  })
})
