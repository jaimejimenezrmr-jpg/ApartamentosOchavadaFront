import { HttpErrorResponse } from '@angular/common/http';
import { RestrictionViolation } from './models';

/** Error de la API en formato Problem Details (RFC 7807) con las extensiones del backend. */
export interface ApiProblem {
  status: number;
  code: string;
  title: string;
  detail: string;
  errors: { field: string; message: string }[];
  restrictions: RestrictionViolation[];
  raw: Record<string, unknown>;
}

const NETWORK_DETAIL = 'No se ha podido contactar con el servidor. Compruebe su conexión e inténtelo de nuevo.';

export function toProblem(error: unknown): ApiProblem {
  if (error instanceof HttpErrorResponse) {
    const body = isRecord(error.error) ? error.error : parseJson(error.error);
    if (error.status === 0) {
      return problem(0, 'network', 'Sin conexión', NETWORK_DETAIL, body);
    }
    return problem(
      error.status,
      str(body['code']) ?? `http.${error.status}`,
      str(body['title']) ?? defaultTitle(error.status),
      str(body['detail']) ?? defaultDetail(error.status),
      body,
    );
  }
  const message = error instanceof Error ? error.message : 'Error inesperado';
  return problem(-1, 'client', 'Error', message, {});
}

/** Mensaje legible para mostrar al usuario. */
export function problemMessage(error: unknown): string {
  const p = toProblem(error);
  if (p.errors.length > 0) {
    return `${p.detail} ${p.errors.map((e) => e.message).join(' · ')}`.trim();
  }
  return p.detail;
}

/** Errores de validación agrupados por campo (para pintarlos junto a cada control). */
export function fieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const e of toProblem(error).errors) {
    result[e.field] ??= e.message;
  }
  return result;
}

function problem(status: number, code: string, title: string, detail: string, raw: Record<string, unknown>): ApiProblem {
  const errors = Array.isArray(raw['errors'])
    ? (raw['errors'] as unknown[]).filter(isRecord).map((e) => ({ field: str(e['field']) ?? '', message: str(e['message']) ?? '' }))
    : [];
  const restrictions = Array.isArray(raw['restrictions']) ? (raw['restrictions'] as RestrictionViolation[]) : [];
  return { status, code, title, detail, errors, restrictions, raw };
}

function defaultTitle(status: number): string {
  if (status === 401) return 'Sesión caducada';
  if (status === 403) return 'Sin permiso';
  if (status === 404) return 'No encontrado';
  if (status === 429) return 'Demasiadas peticiones';
  return status >= 500 ? 'Error del servidor' : 'Petición no válida';
}

function defaultDetail(status: number): string {
  if (status === 401) return 'Su sesión ha caducado. Vuelva a identificarse.';
  if (status === 403) return 'No tiene permiso para realizar esta operación.';
  if (status === 404) return 'El recurso solicitado no existe.';
  if (status === 429) return 'Ha realizado demasiadas peticiones. Espere unos minutos.';
  return status >= 500 ? 'Se ha producido un error en el servidor. Inténtelo de nuevo más tarde.' : 'La petición no es válida.';
}

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
