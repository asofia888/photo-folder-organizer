import { describe, it, expect } from 'vitest'
import exifr from 'exifr'
import { buildExifJpeg, EXIF_FIXTURE_THUMBNAIL } from '../fixtures/exifJpeg'

// Runs the REAL exifr library against a synthetic EXIF JPEG, with the exact
// options photoProcessor.worker.ts uses. A production bug once called a
// non-existent API ((exifr as any).extractThumbnail) that worker mocks could
// never catch — this suite pins the actual library contract.
describe('exifr contract (as used by photoProcessor.worker)', () => {
  const jpeg = buildExifJpeg('2024:06:15 08:30:00')

  it('parse() extracts DateTimeOriginal as a local-time Date', async () => {
    const exifData = await exifr.parse(jpeg, {
      pick: ['DateTimeOriginal', 'CreateDate'],
      translateKeys: true,
      reviveValues: true,
    })

    const date: unknown = exifData?.DateTimeOriginal
    expect(date).toBeInstanceOf(Date)
    const revived = date as Date
    expect(revived.getFullYear()).toBe(2024)
    expect(revived.getMonth()).toBe(5) // June
    expect(revived.getDate()).toBe(15)
    expect(revived.getHours()).toBe(8)
  })

  it('thumbnail() exists and returns the embedded thumbnail bytes', async () => {
    expect(typeof exifr.thumbnail).toBe('function')

    const thumbnail = await exifr.thumbnail(jpeg)
    expect(thumbnail).toBeDefined()
    expect(thumbnail!.byteLength).toBe(EXIF_FIXTURE_THUMBNAIL.byteLength)
    expect(Array.from(thumbnail!)).toEqual(Array.from(EXIF_FIXTURE_THUMBNAIL))
  })
})
