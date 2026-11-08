import { IsoDate } from '../api/models';

/**
 * Utilidades de fechas de calendario (sin hora). Todas trabajan con cadenas `YYYY-MM-DD` y aritmética en
 * UTC para que los cambios de horario de verano no desplacen días.
 */

export const PROPERTY_TIME_ZONE = 'Europe/Madrid';

/** Fecha de hoy en la zona horaria del alojamiento. */
export function todayInProperty(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parse(value);
  return !Number.isNaN(d.getTime()) && format(d) === value;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** Noches entre la entrada y la salida (la salida no se cuenta). */
export function nightsBetween(checkIn: IsoDate, checkOut: IsoDate): number {
  return Math.round((parse(checkOut).getTime() - parse(checkIn).getTime()) / 86_400_000);
}

/** Días de `[from, to)`. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

/** 0 = lunes ... 6 = domingo. */
export function weekdayIndex(date: IsoDate): number {
  return (parse(date).getUTCDay() + 6) % 7;
}

export function isWeekend(date: IsoDate): boolean {
  return weekdayIndex(date) >= 5;
}

/** Lunes de la semana de la fecha. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -weekdayIndex(date));
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = parse(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + months);
  return format(d);
}

/** Instante ISO de las 00:00 del día en UTC (para filtros por rango de instantes). */
export function startOfDayInstant(date: IsoDate): string {
  return `${date}T00:00:00Z`;
}

function parse(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

function format(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}
