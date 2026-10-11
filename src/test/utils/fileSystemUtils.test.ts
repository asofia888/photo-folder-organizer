import { describe, it, expect, vi } from 'vitest'
import { organizePhotosToFolders, ProcessingProgress } from '../../../utils/fileSystemUtils'

// Minimal in-memory implementation of the File System Access handles the
// organizer uses, following the real API's error names.
const domError = (name: string) => Object.assign(new Error(name), { name })

class FakeDirectory {
  // Written files are stored as the Blob that was written, so tests can
  // check which source ended up where.
  readonly files = new Map<string, Blob>()
  readonly dirs = new Map<string, FakeDirectory>()
  failWritesFor = new Set<string>()

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (this.files.has(name)) throw domError('TypeMismatchError')
    let dir = this.dirs.get(name)
    if (!dir) {
      if (!options?.create) throw domError('NotFoundError')
      dir = new FakeDirectory()
      this.dirs.set(name, dir)
    }
    return dir
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (this.dirs.has(name)) throw domError('TypeMismatchError')
    if (!this.files.has(name)) {
      if (!options?.create) throw domError('NotFoundError')
      this.files.set(name, new File([], name))
    }
    return {
      getFile: async () => {
        const blob = this.files.get(name)!
        return blob instanceof File ? blob : new File([blob], name)
      },
      createWritable: async () => {
        let data: Blob | undefined
        return {
          write: async (blob: Blob) => {
            if (this.failWritesFor.has(name)) throw domError('QuotaExceededError')
            data = blob
          },
          close: async () => {
            this.files.set(name, data ?? new Blob([]))
          },
          abort: async () => {},
        }
      },
    }
  }

  async removeEntry(name: string) {
    this.files.delete(name)
  }
}

const photo = (name: string, content = name) => new File([content], name, { type: 'image/jpeg' })

type Args = Parameters<typeof organizePhotosToFolders>
const organize = (target: FakeDirectory, folders: Args[1], onProgress?: Args[2], signal?: Args[3]) =>
  organizePhotosToFolders(target as unknown as FileSystemDirectoryHandle, folders, onProgress, signal)

describe('organizePhotosToFolders', () => {
  it('copies each folder into a new folder and reports progress', async () => {
    const target = new FakeDirectory()
    const progress: ProcessingProgress[] = []

    const a = photo('a.jpg')
    const result = await organize(target, [
      { name: '2024-06-15_Trip', photos: [a, photo('b.jpg')] },
      { name: '2024-06-16_Party', photos: [photo('c.jpg')] },
    ], p => progress.push(p))

    expect(result).toEqual({ success: true, data: { copied: 3, alreadyPresent: 0, renamed: 0 } })
    expect([...target.dirs.keys()]).toEqual(['2024-06-15_Trip', '2024-06-16_Party'])
    expect(target.dirs.get('2024-06-15_Trip')!.files.get('a.jpg')).toBe(a)
    expect(progress.at(-1)).toMatchObject({ status: 'completed', current: 3, total: 3 })
  })

  it('never overwrites a different file that already has the name', async () => {
    const target = new FakeDirectory()
    const existing = await target.getDirectoryHandle('2024-06-15_Trip', { create: true })
    const theirs = new File(['someone else\'s photo'], 'a.jpg')
    existing.files.set('a.jpg', theirs)
    const mine = photo('a.jpg', 'mine')

    const result = await organize(target, [{ name: '2024-06-15_Trip', photos: [mine] }])

    expect(result).toEqual({ success: true, data: { copied: 0, alreadyPresent: 0, renamed: 1 } })
    expect(existing.files.get('a.jpg')).toBe(theirs)
    expect(existing.files.get('a (2).jpg')).toBe(mine)
  })

  it('skips files an earlier run already copied', async () => {
    const target = new FakeDirectory()
    const folders = [{ name: '2024-06-15_Trip', photos: [photo('a.jpg'), photo('b.jpg')] }]

    await organize(target, folders)
    const second = await organize(target, folders)

    expect(second).toEqual({ success: true, data: { copied: 0, alreadyPresent: 2, renamed: 0 } })
    expect([...target.dirs.get('2024-06-15_Trip')!.files.keys()]).toEqual(['a.jpg', 'b.jpg'])
  })

  it('stops before the next file when cancelled and reports what was copied', async () => {
    const target = new FakeDirectory()
    const controller = new AbortController()

    const result = await organize(
      target,
      [{ name: '2024-06-15_Trip', photos: [photo('a.jpg'), photo('b.jpg'), photo('c.jpg')] }],
      p => {
        if (p.status === 'copying' && p.currentFile?.endsWith('b.jpg')) controller.abort()
      },
      controller.signal
    )

    // b.jpg was already being copied when cancel was pressed; c.jpg never starts.
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('CANCELLED')
      expect(result.error.summary).toEqual({ copied: 2, alreadyPresent: 0, renamed: 0 })
    }
    expect(target.dirs.get('2024-06-15_Trip')!.files.has('c.jpg')).toBe(false)
  })

  it('reports which file failed and leaves no empty file behind', async () => {
    const target = new FakeDirectory()
    const folder = await target.getDirectoryHandle('2024-06-15_Trip', { create: true })
    folder.failWritesFor.add('b.jpg')

    const result = await organize(target, [{ name: '2024-06-15_Trip', photos: [photo('a.jpg'), photo('b.jpg')] }])

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('WRITE_FAILED')
      expect(result.error.target).toBe('2024-06-15_Trip/b.jpg')
      expect(result.error.summary).toEqual({ copied: 1, alreadyPresent: 0, renamed: 0 })
    }
    expect(folder.files.has('b.jpg')).toBe(false)
  })

  it('maps a denied write permission to PERMISSION_DENIED', async () => {
    const target = new FakeDirectory()
    target.getDirectoryHandle = vi.fn(async () => {
      throw domError('NotAllowedError')
    })

    const result = await organize(target, [{ name: '2024-06-15_Trip', photos: [photo('a.jpg')] }])

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('PERMISSION_DENIED')
  })

  // Browsers report an empty MIME type for RAW files and image/heic for HEIC;
  // organizing once aborted on them when it validated MIME types.
  it('copies RAW and HEIC files regardless of their MIME type', async () => {
    const target = new FakeDirectory()
    const raw = new File(['raw'], 'IMG_0001.CR2', { type: '' })
    const heic = new File(['heic'], 'IMG_0002.HEIC', { type: 'image/heic' })

    const result = await organize(target, [{ name: '2024-06-15_Trip', photos: [raw, heic] }])

    expect(result).toEqual({ success: true, data: { copied: 2, alreadyPresent: 0, renamed: 0 } })
  })

  it('validates names before writing anything', async () => {
    const target = new FakeDirectory()

    const result = await organize(target, [
      { name: '2024-06-15_ok', photos: [photo('a.jpg')] },
      { name: '2024-06-15_a/b', photos: [photo('b.jpg')] },
    ])

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('INVALID_NAME')
    expect(target.dirs.size).toBe(0)
  })
})
