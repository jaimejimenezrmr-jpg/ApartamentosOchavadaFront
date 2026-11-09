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
    // Centro de control del administrador: accesos a todas las pantallas de gestión.
    path: 'jarvis',
    canActivate: [staffGuard],
    data: { role: 'ADMIN' },
    title: 'Jarvis · Centro de control',
    loadComponent: () => import('./jarvis/jarvis.page').then((m) => m.JarvisPage),
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
