import { IsoDate } from '../../core/api/models';
import { nightsBetween } from '../../core/util/dates';

export interface BarPosition {
  /** Columna de inicio (1 = primer día visible). */
  column: number;
  span: number;
  /** La estancia empieza antes del rango visible. */
  clippedStart: boolean;
  /** La estancia termina después del rango visible. */
  clippedEnd: boolean;
}

/**
 * Posición de una estancia `[start, end)` en una rejilla que muestra las noches `[from, to)`.
 * Devuelve `null` si no se solapa con el rango.
 */
export function barPosition(start: IsoDate, end: IsoDate, from: IsoDate, to: IsoDate): BarPosition | null {
  if (end <= from || start >= to) return null;
  const visibleStart = start < from ? from : start;
  const visibleEnd = end > to ? to : end;
  return {
    column: nightsBetween(from, visibleStart) + 1,
    span: Math.max(1, nightsBetween(visibleStart, visibleEnd)),
    clippedStart: start < from,
    clippedEnd: end > to,
  };
}
