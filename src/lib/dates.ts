/** Utilidades de fecha. Todo en horario local, formato ISO corto YYYY-MM-DD. */

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Los `count` dias a partir de `start` (incluido). */
export function rangeFrom(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function isBetween(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function dayName(iso: string, short = false): string {
  const d = fromISO(iso).getDay();
  return short ? DIAS_CORTO[d] : DIAS[d];
}

export function dayNumber(iso: string): number {
  return fromISO(iso).getDate();
}

export function monthName(iso: string): string {
  return MESES[fromISO(iso).getMonth()];
}

/** "hoy", "manana" o "lunes 12" segun lo cerca que este la fecha. */
export function friendlyDate(iso: string, from = today()): string {
  if (iso === from) return 'hoy';
  if (iso === addDays(from, 1)) return 'mañana';
  return `${dayName(iso)} ${dayNumber(iso)}`;
}

export function formatLong(iso: string): string {
  return `${dayName(iso)} ${dayNumber(iso)} de ${monthName(iso)}`;
}
