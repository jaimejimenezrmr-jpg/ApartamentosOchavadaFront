import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../api/models';
import { StaffSessionService } from './staff-session.service';

export const ACCOUNT_URL = '/backoffice/cuenta';
/** Centro de control: punto de entrada del administrador. */
export const JARVIS_URL = '/jarvis';

/** Página de inicio según el perfil: administración entra en Jarvis; recepción, al panel; limpieza, a su tablero. */
export function homeUrlFor(session: StaffSessionService): string {
  if (session.hasRole('ADMIN')) return JARVIS_URL;
  return session.hasRole('RECEPTIONIST') ? '/backoffice/panel' : '/backoffice/limpieza';
}

/** Exige sesión del personal con al menos el rol indicado en `data.role` (por defecto, HOUSEKEEPING). */
export const staffGuard: CanActivateFn = async (route, state) => {
  const session = inject(StaffSessionService);
  const router = inject(Router);
  if (!session.isAuthenticated()) {
    await session.restore();
  }
  if (!session.isAuthenticated()) {
    return router.createUrlTree(['/backoffice/login'], { queryParams: { returnUrl: state.url } });
  }
  // Con contraseña temporal solo se puede entrar en «Mi cuenta» para cambiarla.
  if (session.user()?.passwordChangeRequired && !state.url.startsWith(ACCOUNT_URL)) {
    return router.createUrlTree([ACCOUNT_URL]);
  }
  const required = (route.data['role'] as UserRole | undefined) ?? 'HOUSEKEEPING';
  return session.hasRole(required) ? true : router.createUrlTree(['/backoffice/sin-permiso']);
};

/** En el login: si ya hay sesión, directamente a su página de inicio. */
export const loginGuard: CanActivateFn = async () => {
  const session = inject(StaffSessionService);
  const router = inject(Router);
  await session.restore();
  return session.isAuthenticated() ? router.createUrlTree([homeUrlFor(session)]) : true;
};
