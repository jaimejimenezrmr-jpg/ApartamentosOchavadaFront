import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { GuestSessionService } from '../auth/guest-session.service';
import { StaffSessionService } from '../auth/staff-session.service';
import { API_ORIGIN } from '../config/site-config';

const STAFF_PATHS = ['/api/v1/backoffice/', '/api/v1/admin/', '/api/v1/auth/me'];
const GUEST_PUBLIC = '/api/v1/guest/auth/';

/**
 * Prefija el origen de la API (necesario al renderizar en el servidor) y añade el token adecuado:
 * JWT del personal para backoffice/admin (renovándolo si hace falta y reintentando una vez tras un 401) y
 * JWT del huésped para `/api/v1/guest/**`.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }
  const origin = inject(API_ORIGIN);
  const path = req.url;
  const withOrigin = (r: HttpRequest<unknown>) => r.clone({ url: origin + path });

  if (STAFF_PATHS.some((p) => path.startsWith(p))) {
    const staff = inject(StaffSessionService);
    const router = inject(Router);
    const authorize = (token: string | null) =>
      token ? withOrigin(req).clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : withOrigin(req);
    return staff.validToken().pipe(
      switchMap((token) => next(authorize(token))),
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
          return throwError(() => error);
        }
        // Token revocado o caducado entre medias: un único intento de renovación.
        return staff.refresh().pipe(
          switchMap((token) => {
            if (!token) {
              void staff.expire(router.url);
              return throwError(() => error);
            }
            return next(authorize(token));
          }),
        );
      }),
    );
  }

  if (path.startsWith('/api/v1/guest/') && !path.startsWith(GUEST_PUBLIC)) {
    const guest = inject(GuestSessionService);
    const token = guest.token();
    const request = token ? withOrigin(req).clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : withOrigin(req);
    return next(request).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          guest.clear();
        }
        return throwError(() => error);
      }),
    );
  }

  return next(withOrigin(req));
};
