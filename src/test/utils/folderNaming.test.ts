import { describe, it, expect } from 'vitest'
import { buildFinalFolderName, findFolderNameIssues } from '../../../utils/folderNaming'
import type { Folder } from '../../../types'

const folder = (id: string, newName: string, date: Date | null = new Date(2024, 5, 15)): Folder => ({
  id,
  originalName: id,
  photos: [],
  representativeDate: date,
  newName,
  isRenamed: false,
})

describe('buildFinalFolderName', () => {
  it('prefixes the local date and trims the entered name', () => {
    expect(buildFinalFolderName(folder('a', '  Trip  '), 'Unknown_Date')).toBe('2024-06-15_Trip')
  })

  it('uses the unknown-date label when the folder has no date', () => {
    expect(buildFinalFolderName(folder('a', 'Trip', null), '日付不明')).toBe('日付不明_Trip')
  })
})

describe('findFolderNameIssues', () => {
  it('ignores folders without a name', () => {
    expect(findFolderNameIssues([folder('a', ''), folder('b', '   ')], 'x').size).toBe(0)
  })

  it('flags names a file system would reject', () => {
    const issues = findFolderNameIssues(
      [folder('slash', 'a/b'), folder('colon', 'a:b'), folder('dot', 'trip.'), folder('ok', '旅行 $(x)')],
      'x'
    )
    expect(issues.get('slash')).toBe('invalid')
    expect(issues.get('colon')).toBe('invalid')
    expect(issues.get('dot')).toBe('invalid')
    // Shell metacharacters are legal in folder names; the script quotes them.
    expect(issues.has('ok')).toBe(false)
  })

  it('flags every folder that would share a final name, ignoring case', () => {
    const issues = findFolderNameIssues([folder('a', 'Trip'), folder('b', 'trip'), folder('c', 'Other')], 'x')
    expect(issues.get('a')).toBe('duplicate')
    expect(issues.get('b')).toBe('duplicate')
    expect(issues.has('c')).toBe(false)
  })

  it('treats composed and decomposed Japanese as the same name', () => {
    const composed = 'が'.normalize('NFC')
    const decomposed = 'が'.normalize('NFD')
    const issues = findFolderNameIssues([folder('a', composed), folder('b', decomposed)], 'x')
    expect(issues.get('a')).toBe('duplicate')
  })

  it('allows the same name on different dates', () => {
    const issues = findFolderNameIssues(
      [folder('a', 'Trip', new Date(2024, 0, 1)), folder('b', 'Trip', new Date(2024, 0, 2))],
      'x'
    )
    expect(issues.size).toBe(0)
  })
})
