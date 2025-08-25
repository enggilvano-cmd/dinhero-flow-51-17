// Date utilities to handle timezone issues consistently

/**
 * Creates a Date object from a date string (YYYY-MM-DD) avoiding timezone issues
 * by creating the date directly from components to ensure local time
 */
export function createDateFromString(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Parse the date components to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
  
  // Create date with local time at 12:00:00 to avoid timezone edge cases
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Formats a Date object to YYYY-MM-DD string for database storage
 */
export function formatDateForStorage(date: Date): string {
  if (!date || !(date instanceof Date)) return new Date().toISOString().split('T')[0];
  
  // Get local date components to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  return formatDateForStorage(new Date());
}

/**
 * Compares two dates as strings (YYYY-MM-DD format) or Date objects
 */
export function compareDates(date1: string | Date, date2: string | Date): number {
  const d1 = typeof date1 === 'string' ? createDateFromString(date1) : date1;
  const d2 = typeof date2 === 'string' ? createDateFromString(date2) : date2;
  
  return d1.getTime() - d2.getTime();
}

/**
 * Adds months to a date while preserving the day of month
 */
export function addMonthsToDate(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  
  // Ensure time stays consistent (12:00:00)
  result.setHours(12, 0, 0, 0);
  
  return result;
}