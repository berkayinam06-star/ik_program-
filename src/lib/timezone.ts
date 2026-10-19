/**
 * Timezone utilities for Europe/Istanbul
 * All date/time operations must be performed in Turkey local time (TRT, UTC+3).
 */

export const TZ = "Europe/Istanbul";

/**
 * Returns the "work date" for a given UTC timestamp in Istanbul timezone.
 * Night shift rule: if the event occurs between 00:00–05:59 Istanbul local time,
 * it is still considered part of the PREVIOUS calendar day's shift.
 *
 * Example: 22:00 IN on Day 1, 06:00 OUT on Day 2 → both belong to Day 1.
 */
export function getWorkDate(utcDate: Date): Date {
  // Get Istanbul local time components
  const istanbulFormatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = istanbulFormatter.formatToParts(utcDate);
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  const year  = getPart("year");
  const month = getPart("month");
  const day   = getPart("day");
  const hour  = getPart("hour");

  // Night shift cut-off: events before 06:00 local belong to the previous calendar day
  let workDay = new Date(Date.UTC(year, month - 1, day));
  if (hour < 6) {
    workDay = new Date(workDay.getTime() - 24 * 60 * 60 * 1000);
  }
  return workDay; // Stored as UTC midnight (date-only)
}

/**
 * Format a UTC date as a local Istanbul date string (YYYY-MM-DD)
 */
export function toIstanbulDateString(utcDate: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate);
}

/**
 * Format a UTC datetime to a human-readable Istanbul local time string
 */
export function toIstanbulTimeString(utcDate: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(utcDate);
}

/**
 * Format a UTC datetime to a full Istanbul local datetime string
 */
export function toIstanbulDateTimeString(utcDate: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(utcDate);
}

/**
 * Parse a "YYYY-MM-DD HH:mm" string in Istanbul timezone and return a UTC Date.
 */
export function parseIstanbulDateTime(dateStr: string, timeStr: string): Date {
  // dateStr: "2024-01-15", timeStr: "08:30"
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Calculate offset for Europe/Istanbul (UTC+3, no DST since 2016)
  // Turkey has been permanently at UTC+3 since 2016
  const utcMs = Date.UTC(year, month - 1, day, hour - 3, minute, 0, 0);
  return new Date(utcMs);
}

/**
 * Get the first and last UTC instant of a given Istanbul local month
 */
export function getMonthBounds(year: number, month: number): { start: Date; end: Date } {
  // Month is 1-indexed. Turkey = UTC+3 (permanent since 2016)
  const start = new Date(Date.UTC(year, month - 1, 1, -3, 0, 0, 0)); // 00:00 Istanbul = -3h UTC
  const end   = new Date(Date.UTC(year, month, 1, -3, 0, 0, -1));     // end of last day Istanbul
  return { start, end };
}

/**
 * Get all calendar days in a given year/month as UTC Date objects (midnight UTC)
 */
export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const count = new Date(year, month, 0).getDate(); // JS month is 0-indexed for this trick
  for (let d = 1; d <= count; d++) {
    days.push(new Date(Date.UTC(year, month - 1, d)));
  }
  return days;
}

/**
 * Format a UTC date-only value as DD.MM.YYYY
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year  = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Returns true if a given Date represents a Saturday or Sunday (UTC)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Format minutes as HH:MM string (e.g. 90 → "1:30")
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0:00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
