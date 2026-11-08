import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { StaffSessionService } from '../core/auth/staff-session.service';
import { staffGuard } from '../core/auth/guards';
import { BackofficeLayoutComponent } from './layout/backoffice-layout.component';

const R = { role: 'RECEPTIONIST' };

const homeRedirect: CanActivateFn = async () => {
  // inject() antes de cualquier await: después se pierde el contexto de inyección.
  const session = inject(StaffSessionService);
  const router = inject(Router);
  await session.restore();
  if (session.user()?.passwordChangeRequired) {
    return router.createUrlTree(['/backoffice', 'cuenta']);
  }
  return router.createUrlTree(['/backoffice', session.hasRole('RECEPTIONIST') ? 'panel' : 'limpieza']);
};
const A = { role: 'ADMIN' };

export const BACKOFFICE_ROUTES: Routes = [
  {
    path: '',
    component: BackofficeLayoutComponent,
    canActivateChild: [staffGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        // Se decide en un guard (no en `redirectTo`) porque debe esperar a que se recupere la sesión:
        // el personal de limpieza entra directamente a su tablero.
        canActivate: [homeRedirect],
        children: [],
      },
      { path: 'panel', data: R, title: 'Panel · Backoffice', loadComponent: () => import('./dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'rack', data: R, title: 'Rack · Backoffice', loadComponent: () => import('./rack/rack.page').then((m) => m.RackPage) },
      { path: 'reservas', data: R, title: 'Reservas · Backoffice', loadComponent: () => import('./reservations/reservation-list.page').then((m) => m.ReservationListPage) },
      { path: 'reservas/nueva', data: R, title: 'Nueva reserva · Backoffice', loadComponent: () => import('./reservations/reservation-new.page').then((m) => m.ReservationNewPage) },
      { path: 'reservas/:id', data: R, title: 'Reserva · Backoffice', loadComponent: () => import('./reservations/reservation-detail.page').then((m) => m.ReservationDetailPage) },
      { path: 'huespedes', data: R, title: 'Huéspedes · Backoffice', loadComponent: () => import('./guests/guest-list.page').then((m) => m.GuestListPage) },
      { path: 'huespedes/:id', data: R, title: 'Huésped · Backoffice', loadComponent: () => import('./guests/guest-detail.page').then((m) => m.GuestDetailPage) },
      { path: 'limpieza', data: { role: 'HOUSEKEEPING' }, title: 'Limpieza · Backoffice', loadComponent: () => import('./housekeeping/housekeeping.page').then((m) => m.HousekeepingPage) },
      { path: 'tarifas', data: R, title: 'Tarifas · Backoffice', loadComponent: () => import('./rates/rates.page').then((m) => m.RatesPage) },
      { path: 'facturas', data: R, title: 'Facturas · Backoffice', loadComponent: () => import('./invoices/invoice-list.page').then((m) => m.InvoiceListPage) },
      { path: 'facturas/:id', data: R, title: 'Factura · Backoffice', loadComponent: () => import('./invoices/invoice-detail.page').then((m) => m.InvoiceDetailPage) },
      { path: 'ses', data: R, title: 'SES.HOSPEDAJES · Backoffice', loadComponent: () => import('./ses/ses.page').then((m) => m.SesPage) },
      { path: 'cerraduras', data: R, title: 'Cerraduras · Backoffice', loadComponent: () => import('./locks/locks.page').then((m) => m.LocksPage) },
      { path: 'catalogo', data: A, title: 'Catálogo · Backoffice', loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage) },
      { path: 'usuarios', data: A, title: 'Usuarios · Backoffice', loadComponent: () => import('./users/users.page').then((m) => m.UsersPage) },
      { path: 'cuenta', title: 'Mi cuenta · Backoffice', loadComponent: () => import('./account/account.page').then((m) => m.AccountPage) },
      { path: 'canal', data: A, title: 'Channel manager · Backoffice', loadComponent: () => import('./channel/channel.page').then((m) => m.ChannelPage) },
      { path: 'sin-permiso', title: 'Sin permiso · Backoffice', loadComponent: () => import('./forbidden.page').then((m) => m.ForbiddenPage) },
      { path: '**', redirectTo: () => inject(Router).createUrlTree(['/backoffice']) },
    ],
  },
];
