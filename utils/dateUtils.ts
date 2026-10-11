/**
 * Date utility functions for consistent date handling
 */

import type { DateLogic } from '../types';

export const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime());

/**
 * Formats a date for script generation (YYYY-MM-DD).
 * Uses local date parts — toISOString() would convert to UTC and shift
 * photos taken before 09:00 JST to the previous day.
 */
export const formatScriptDate = (date: Date | null): string => {
  if (!date) return 'unknown';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Picks the date that represents a folder. EXIF capture dates win; only when
 * no photo has one (screenshots, images saved from chat apps or the web) are
 * file modification times used, and the result is flagged as estimated.
 */
export const pickRepresentativeDate = (
  photos: ReadonlyArray<{ readonly exifDate: Date | null; readonly fileDate: Date | null }>,
  dateLogic: DateLogic
): { date: Date | null; isEstimated: boolean } => {
  const exifDates = photos.map(p => p.exifDate).filter(isValidDate);
  const candidates = exifDates.length > 0 ? exifDates : photos.map(p => p.fileDate).filter(isValidDate);
  if (candidates.length === 0) {
    return { date: null, isEstimated: false };
  }

  // reduce rather than Math.min(...spread): folders can hold many thousands.
  const time = candidates
    .map(d => d.getTime())
    .reduce((a, b) => (dateLogic === 'earliest' ? Math.min(a, b) : Math.max(a, b)));
  return { date: new Date(time), isEstimated: exifDates.length === 0 };
};
