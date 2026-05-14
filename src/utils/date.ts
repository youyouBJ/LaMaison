// Timezone cible du restaurant : Africa/Tunis (UTC+1, sans DST depuis 2008).
// La gestion des cas edge (changement de date en cours de service nocturne)
// sera renforcée dans un module ultérieur.

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
