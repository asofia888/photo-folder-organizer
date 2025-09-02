/**
 * Date utility functions for consistent date handling
 */

/**
 * Formats a date for display in the UI
 */
export const formatDisplayDate = (date: Date | null): string => {
  if (!date) return 'Unknown Date';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Formats a date for script generation (YYYY-MM-DD)
 */
export const formatScriptDate = (date: Date | null): string => {
  if (!date) return 'unknown';
  return date.toISOString().split('T')[0];
};

/**
 * Formats a date for JSON serialization
 */
export const formatJsonDate = (date: Date | null): string | null => {
  if (!date) return null;
  return date.toISOString();
};

/**
 * Parses a date from JSON string
 */
export const parseJsonDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Checks if a date is valid
 */
export const isValidDate = (date: Date | null): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Compares two dates for sorting
 */
export const compareDates = (a: Date | null, b: Date | null): number => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.getTime() - b.getTime();
};

/**
 * Gets the earliest date from an array of dates
 */
export const getEarliestDate = (dates: (Date | null)[]): Date | null => {
  const validDates = dates.filter(isValidDate);
  if (validDates.length === 0) return null;
  
  return new Date(Math.min(...validDates.map(d => d.getTime())));
};

/**
 * Gets the latest date from an array of dates
 */
export const getLatestDate = (dates: (Date | null)[]): Date | null => {
  const validDates = dates.filter(isValidDate);
  if (validDates.length === 0) return null;
  
  return new Date(Math.max(...validDates.map(d => d.getTime())));
};