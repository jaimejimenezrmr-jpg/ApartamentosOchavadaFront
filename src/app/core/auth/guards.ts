import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../api/models';
import { StaffSessionService } from './staff-session.service';

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
  const required = (route.data['role'] as UserRole | undefined) ?? 'HOUSEKEEPING';
  return session.hasRole(required) ? true : router.createUrlTree(['/backoffice/sin-permiso']);
};

/** En el login: si ya hay sesión, directamente al panel. */
export const loginGuard: CanActivateFn = async () => {
  const session = inject(StaffSessionService);
  const router = inject(Router);
  await session.restore();
  return session.isAuthenticated() ? router.createUrlTree(['/backoffice']) : true;
};
