import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyNameDraft, clearNameDraft, saveNameDraft } from '../../../utils/nameDrafts'
import type { Folder } from '../../../types'

// setup.ts replaces localStorage with bare mocks; back them with a Map here.
const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => store.get(key) ?? null)
  vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => {
    store.set(key, value)
  })
})

const folder = (id: string, newName = '', isRenamed = false, date = new Date(2024, 0, 1)): Folder => ({
  id,
  originalName: id,
  photos: [],
  representativeDate: date,
  newName,
  isRenamed,
})

describe('name drafts', () => {
  it('restores names typed for the same root folder', () => {
    saveNameDraft('Photos', [folder('/Photos/a', 'Trip', true), folder('/Photos/b', 'Party'), folder('/Photos/c')])

    const { folders, restoredCount } = applyNameDraft('Photos', [folder('/Photos/a'), folder('/Photos/b'), folder('/Photos/c')], 'x')

    expect(restoredCount).toBe(2)
    expect(folders.map(f => [f.newName, f.isRenamed])).toEqual([['Trip', true], ['Party', false], ['', false]])
  })

  it('keeps drafts of different root folders apart', () => {
    saveNameDraft('Photos', [folder('/Photos/a', 'Trip')])

    expect(applyNameDraft('Other', [folder('/Photos/a')], 'x').restoredCount).toBe(0)
  })

  it('makes a confirmed name editable again when it no longer validates', () => {
    // Saved on different dates; now both folders resolve to the same date.
    saveNameDraft('Photos', [
      folder('/Photos/a', 'Trip', true, new Date(2024, 0, 1)),
      folder('/Photos/b', 'Trip', true, new Date(2024, 0, 2)),
    ])

    const { folders } = applyNameDraft('Photos', [folder('/Photos/a'), folder('/Photos/b')], 'x')

    expect(folders.every(f => f.newName === 'Trip' && !f.isRenamed)).toBe(true)
  })

  it('forgets a draft when every name is cleared', () => {
    saveNameDraft('Photos', [folder('/Photos/a', 'Trip')])
    saveNameDraft('Photos', [folder('/Photos/a', '  ')])

    expect(applyNameDraft('Photos', [folder('/Photos/a')], 'x').restoredCount).toBe(0)
  })

  it('clearNameDraft removes only that root', () => {
    saveNameDraft('Photos', [folder('/Photos/a', 'Trip')])
    saveNameDraft('Other', [folder('/Other/a', 'Party')])

    clearNameDraft('Photos')

    expect(applyNameDraft('Photos', [folder('/Photos/a')], 'x').restoredCount).toBe(0)
    expect(applyNameDraft('Other', [folder('/Other/a')], 'x').restoredCount).toBe(1)
  })

  it('ignores corrupted or unavailable storage', () => {
    store.set('photoFolderOrganizer.nameDrafts', '{not json')
    expect(applyNameDraft('Photos', [folder('/Photos/a')], 'x').restoredCount).toBe(0)

    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveNameDraft('Photos', [folder('/Photos/a', 'Trip')])).not.toThrow()
  })
})
