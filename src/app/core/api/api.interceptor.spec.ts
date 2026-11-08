import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GuestSessionService } from '../auth/guest-session.service';
import { StaffSessionService } from '../auth/staff-session.service';
import { API_ORIGIN } from '../config/site-config';
import { apiInterceptor } from './api.interceptor';

const user = { id: 'u1', email: 'rec@test.local', fullName: 'Recepción', role: 'RECEPTIONIST' as const, lastLoginAt: null };

function tokenResponse(token: string, inSeconds = 900) {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: inSeconds,
    expiresAt: new Date(Date.now() + inSeconds * 1000).toISOString(),
    user,
  };
}

describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  function setup(origin = '') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: API_ORIGIN, useValue: origin },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    backend.verify();
    sessionStorage.clear();
  });

  it('prefija el origen de la API y no añade credenciales a las rutas públicas', async () => {
    setup('http://backend:8080');
    const pending = firstValueFrom(http.get('/api/v1/public/room-types'));
    const req = backend.expectOne('http://backend:8080/api/v1/public/room-types');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    expect(await pending).toEqual([]);
  });

  it('renueva el token del personal con la cookie y lo envía como Bearer', async () => {
    setup();
    const pending = firstValueFrom(http.get('/api/v1/backoffice/dashboard'));
    const refresh = backend.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush(tokenResponse('tok-1'));
    const req = backend.expectOne('/api/v1/backoffice/dashboard');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush({ ok: true });
    expect(await pending).toEqual({ ok: true });
    expect(TestBed.inject(StaffSessionService).user()?.role).toBe('RECEPTIONIST');
  });

  it('tras un 401 renueva una sola vez y repite la petición', async () => {
    setup();
    const session = TestBed.inject(StaffSessionService);
    const login = session.login('rec@test.local', 'x');
    backend.expectOne('/api/v1/auth/login').flush(tokenResponse('revocado'));
    await login;

    const pending = firstValueFrom(http.get('/api/v1/admin/room-types'));
    backend.expectOne('/api/v1/admin/room-types').flush({ code: 'auth.invalid_token' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(tokenResponse('nuevo'));
    const retry = backend.expectOne('/api/v1/admin/room-types');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
    retry.flush([]);
    expect(await pending).toEqual([]);
  });

  it('usa el JWT del huésped en el portal, salvo en el canje del enlace', async () => {
    setup();
    TestBed.inject(GuestSessionService).store({
      accessToken: 'guest-jwt', tokenType: 'Bearer', expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(), reservationCode: 'OCH-1',
    });
    const stay = firstValueFrom(http.get('/api/v1/guest/stay'));
    const req = backend.expectOne('/api/v1/guest/stay');
    expect(req.request.headers.get('Authorization')).toBe('Bearer guest-jwt');
    req.flush({});
    await stay;

    const exchange = firstValueFrom(http.post('/api/v1/guest/auth/exchange', { token: 't' }));
    const ex = backend.expectOne('/api/v1/guest/auth/exchange');
    expect(ex.request.headers.has('Authorization')).toBe(false);
    ex.flush({});
    await exchange;
  });

  it('borra la sesión del huésped si la API la rechaza', async () => {
    setup();
    const guest = TestBed.inject(GuestSessionService);
    guest.store({
      accessToken: 'caducado', tokenType: 'Bearer', expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(), reservationCode: 'OCH-1',
    });
    const doors = firstValueFrom(http.get('/api/v1/guest/doors')).catch(() => 'rejected');
    backend.expectOne('/api/v1/guest/doors').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await doors).toBe('rejected');
    expect(guest.session()).toBeNull();
  });
});
