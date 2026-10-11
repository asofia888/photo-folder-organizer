// Pin a timezone east of UTC: the regression this file guards against
// (formatting dates via toISOString) only shifts dates when local time is
// ahead of UTC, and CI runners default to UTC. Node on Linux re-reads TZ when
// process.env.TZ changes, and vitest isolates each test file in its own
// process, so this does not leak into other suites.
process.env.TZ = 'Asia/Tokyo'

import { describe, it, expect } from 'vitest'
import { formatScriptDate, pickRepresentativeDate } from '../../../utils/dateUtils'

describe('formatScriptDate', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(formatScriptDate(new Date(2024, 5, 15, 12, 0, 0))).toBe('2024-06-15')
  })

  it('does not shift early-morning JST dates to the previous day', () => {
    // 08:30 JST is 23:30 UTC of the previous day; toISOString-based
    // formatting used to return 2024-06-14 for this date.
    expect(formatScriptDate(new Date(2024, 5, 15, 8, 30, 0))).toBe('2024-06-15')
    expect(formatScriptDate(new Date(2024, 0, 1, 0, 0, 1))).toBe('2024-01-01')
  })

  it('zero-pads month and day', () => {
    expect(formatScriptDate(new Date(2024, 2, 5, 10, 0, 0))).toBe('2024-03-05')
  })

  it("returns 'unknown' for null", () => {
    expect(formatScriptDate(null)).toBe('unknown')
  })
})

describe('pickRepresentativeDate', () => {
  const jan1 = new Date(2024, 0, 1)
  const jan5 = new Date(2024, 0, 5)
  const feb1 = new Date(2024, 1, 1)

  it('picks the earliest or latest EXIF date', () => {
    const photos = [
      { exifDate: jan5, fileDate: feb1 },
      { exifDate: jan1, fileDate: feb1 },
    ]
    expect(pickRepresentativeDate(photos, 'earliest')).toEqual({ date: jan1, isEstimated: false })
    expect(pickRepresentativeDate(photos, 'latest')).toEqual({ date: jan5, isEstimated: false })
  })

  it('ignores file dates when any photo has an EXIF date', () => {
    const photos = [
      { exifDate: null, fileDate: jan1 },
      { exifDate: jan5, fileDate: feb1 },
    ]
    expect(pickRepresentativeDate(photos, 'earliest')).toEqual({ date: jan5, isEstimated: false })
  })

  it('falls back to file dates, flagged as estimated, when no photo has EXIF', () => {
    const photos = [
      { exifDate: null, fileDate: feb1 },
      { exifDate: null, fileDate: jan5 },
    ]
    expect(pickRepresentativeDate(photos, 'earliest')).toEqual({ date: jan5, isEstimated: true })
  })

  it('returns no date when nothing is known', () => {
    expect(pickRepresentativeDate([{ exifDate: null, fileDate: null }], 'earliest')).toEqual({ date: null, isEstimated: false })
  })
})
