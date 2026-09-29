/** Fecha local YYYY-MM-DD (no UTC), para que la asistencia caiga en el día correcto. */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes de la semana de d. */
export function weekStart(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Semanas consecutivas (terminando en la actual o la anterior) en que se cumplió la meta. */
export function weeklyStreak(dates: string[], goal: number): number {
  const byWeek = new Map<string, Set<string>>();
  for (const s of dates) {
    const k = localDate(weekStart(parseLocal(s)));
    if (!byWeek.has(k)) byWeek.set(k, new Set());
    byWeek.get(k)!.add(s);
  }
  let streak = 0;
  let cursor = weekStart();
  // La semana actual cuenta solo si ya se cumplió; si no, empezamos desde la anterior.
  if ((byWeek.get(localDate(cursor))?.size ?? 0) >= goal) streak++;
  cursor = addDays(cursor, -7);
  while ((byWeek.get(localDate(cursor))?.size ?? 0) >= goal) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

export const WEEKDAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}
