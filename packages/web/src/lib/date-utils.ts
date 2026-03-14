import { startOfWeek, addDays, format, subWeeks, addWeeks } from 'date-fns';

/** Get Monday of the week containing the given date */
export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}

export function getWeekStartISO(date: Date = new Date()): string {
  return format(getWeekStart(date), 'yyyy-MM-dd');
}

export function getDayOfWeek(date: Date): string[] {
  const monday = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(monday, i), 'EEE d MMM')
  );
}

export function getDayDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function prevWeek(weekStart: Date): Date {
  return subWeeks(weekStart, 1);
}

export function nextWeek(weekStart: Date): Date {
  return addWeeks(weekStart, 1);
}

export function formatPace(metersPerSecond: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (!metersPerSecond || metersPerSecond === 0) return '—';
  const secondsPerKm = 1000 / metersPerSecond;
  const secondsPerMile = 1609.34 / metersPerSecond;
  const pace = unit === 'metric' ? secondsPerKm : secondsPerMile;
  const minutes = Math.floor(pace / 60);
  const seconds = Math.round(pace % 60);
  const suffix = unit === 'metric' ? '/km' : '/mi';
  return `${minutes}:${seconds.toString().padStart(2, '0')}${suffix}`;
}

export function formatDistance(meters: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'imperial') {
    return `${(meters / 1609.34).toFixed(2)} mi`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
