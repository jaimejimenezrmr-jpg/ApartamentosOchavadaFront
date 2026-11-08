import { HttpErrorResponse } from '@angular/common/http';
import { fieldErrors, problemMessage, toProblem } from './problem';

describe('problem (RFC 7807)', () => {
  it('lee code, detail, errores de campo y restricciones', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        type: 'https://api/problems/reservation.rate_not_bookable',
        title: 'Regla de negocio',
        detail: 'La tarifa no admite esta estancia',
        code: 'reservation.rate_not_bookable',
        restrictions: [{ code: 'MIN_STAY', message: 'Mínimo 2 noches', value: 2, date: '2026-11-10' }],
        errors: [{ field: 'guest.email', message: 'Email no válido' }],
      },
    });
    const p = toProblem(error);
    expect(p.status).toBe(422);
    expect(p.code).toBe('reservation.rate_not_bookable');
    expect(p.restrictions[0].code).toBe('MIN_STAY');
    expect(fieldErrors(error)).toEqual({ 'guest.email': 'Email no válido' });
    expect(problemMessage(error)).toBe('La tarifa no admite esta estancia Email no válido');
  });

  it('acepta cuerpos de error como texto JSON', () => {
    const error = new HttpErrorResponse({ status: 409, error: JSON.stringify({ code: 'reservation.sold_out', detail: 'Agotado' }) });
    expect(toProblem(error).code).toBe('reservation.sold_out');
    expect(problemMessage(error)).toBe('Agotado');
  });

  it('da mensajes por defecto para red caída y errores sin cuerpo', () => {
    expect(toProblem(new HttpErrorResponse({ status: 0 })).code).toBe('network');
    expect(problemMessage(new HttpErrorResponse({ status: 403 }))).toContain('permiso');
    expect(problemMessage(new HttpErrorResponse({ status: 503, error: '<html>' }))).toContain('servidor');
    expect(problemMessage(new Error('Fallo local'))).toBe('Fallo local');
  });
});
