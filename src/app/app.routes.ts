import { Routes } from '@angular/router';
import { loginGuard, staffGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: 'backoffice/login',
    canActivate: [loginGuard],
    title: 'Acceso del personal · Apartamentos Ochavada',
    loadComponent: () => import('./backoffice/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'backoffice',
    canActivate: [staffGuard],
    loadChildren: () => import('./backoffice/backoffice.routes').then((m) => m.BACKOFFICE_ROUTES),
  },
  {
    path: '',
    loadChildren: () => import('./public/public.routes').then((m) => m.PUBLIC_ROUTES),
  },
];
