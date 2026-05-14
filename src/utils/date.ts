// Timezone cible du restaurant : Africa/Tunis (UTC+1, sans DST depuis 2008).
// La gestion des cas edge (changement de date en cours de service nocturne)
// sera renforcée dans un module ultérieur.

export type CalendarDay = {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

export function parseDateString(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (
    isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) return null;
  return dt;
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMonthLabel(dateString: string): string {
  const parsed = parseDateString(dateString);
  if (!parsed) return '';
  return `${MONTH_NAMES_FR[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

export function addMonthsToDateString(dateString: string, months: number): string {
  const parsed = parseDateString(dateString);
  if (!parsed) return dateString;
  const day = parsed.getDate();
  const targetFirst = new Date(parsed.getFullYear(), parsed.getMonth() + months, 1);
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  return toDateString(new Date(targetFirst.getFullYear(), targetFirst.getMonth(), Math.min(day, lastDay)));
}

export function isSameDate(dateA: string, dateB: string): boolean {
  return dateA === dateB;
}

export function isDateBefore(dateA: string, dateB: string): boolean {
  return dateA < dateB;
}

export function isDateAfter(dateA: string, dateB: string): boolean {
  return dateA > dateB;
}

export function getMonthMatrix(dateString: string): CalendarDay[][] {
  const parsed = parseDateString(dateString);
  if (!parsed) return [];

  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const todayStr = getTodayDateString();

  const firstOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  // Monday-first week: (JS Sunday=0 → offset 6, Monday=1 → offset 0, …)
  const startOffset = (firstOfMonth.getDay() + 6) % 7;

  const cells: CalendarDay[] = [];

  // Pad with trailing days of previous month
  const prevMonthEnd = new Date(year, month, 0);
  const prevYear = prevMonthEnd.getFullYear();
  const prevMonth = prevMonthEnd.getMonth() + 1;
  const prevLast = prevMonthEnd.getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevLast - i;
    const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date, dayNumber: d, isCurrentMonth: false, isToday: date === todayStr });
  }

  // Current month days
  for (let d = 1; d <= lastDayOfMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date, dayNumber: d, isCurrentMonth: true, isToday: date === todayStr });
  }

  // Pad to complete last week with next month days
  const remaining = (7 - (cells.length % 7)) % 7;
  const nextFirst = new Date(year, month + 1, 1);
  const nextYear = nextFirst.getFullYear();
  const nextMonth = nextFirst.getMonth() + 1;
  for (let d = 1; d <= remaining; d++) {
    const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date, dayNumber: d, isCurrentMonth: false, isToday: date === todayStr });
  }

  const matrix: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    matrix.push(cells.slice(i, i + 7));
  }
  return matrix;
}

export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatReadableDate(date: Date): string {
  const raw = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatTimeSlot(time: string): string {
  return time.length >= 5 ? time.substring(0, 5) : time;
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function getTomorrowDateString(): string {
  return addDaysToDateString(getTodayDateString(), 1);
}

export function getCurrentTimeInTunis(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}
