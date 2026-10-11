import { describe, it, expect } from 'vitest'
import {
  isSupportedImageFileName,
  isRawFileName,
  createValidFileName,
  createValidFolderName,
} from '../../../utils/typeGuards'

describe('isSupportedImageFileName', () => {
  it('accepts standard extensions case-insensitively', () => {
    expect(isSupportedImageFileName('a.jpg')).toBe(true)
    expect(isSupportedImageFileName('b.HEIC')).toBe(true)
    expect(isSupportedImageFileName('c.Png')).toBe(true)
    expect(isSupportedImageFileName('d.heif')).toBe(true)
    expect(isSupportedImageFileName('e.TIF')).toBe(true)
  })

  it('accepts RAW extensions', () => {
    expect(isSupportedImageFileName('x.CR2')).toBe(true)
    expect(isSupportedImageFileName('y.nef')).toBe(true)
    expect(isRawFileName('x.CR2')).toBe(true)
    expect(isRawFileName('a.jpg')).toBe(false)
  })

  it('rejects non-image files', () => {
    expect(isSupportedImageFileName('notes.txt')).toBe(false)
    expect(isSupportedImageFileName('no-extension')).toBe(false)
  })
})

describe('createValidFileName', () => {
  it('rejects path separators', () => {
    expect(createValidFileName('a/b')).toBeNull()
    expect(createValidFileName('a\\b')).toBeNull()
    expect(createValidFileName('..\\escape')).toBeNull()
  })

  it('rejects Windows-invalid characters, reserved names, and trailing dots', () => {
    expect(createValidFileName('a<b')).toBeNull()
    expect(createValidFileName('a:b')).toBeNull()
    expect(createValidFileName('CON')).toBeNull()
    expect(createValidFileName('name.')).toBeNull()
    expect(createValidFileName(' padded ')).toBeNull()
    expect(createValidFileName('')).toBeNull()
  })

  it('accepts ordinary names including Japanese', () => {
    expect(createValidFileName('2024-06-15_夏休み')).toBe('2024-06-15_夏休み')
    expect(createValidFileName('photo.jpg')).toBe('photo.jpg')
    expect(createValidFolderName('Summer_Vacation')).toBe('Summer_Vacation')
  })
})
