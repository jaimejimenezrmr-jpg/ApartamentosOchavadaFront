import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout.component';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'apartamentos/:slug',
        loadComponent: () => import('./room/room-detail.page').then((m) => m.RoomDetailPage),
      },
      {
        path: 'buscar',
        title: 'Disponibilidad y precios · Apartamentos Ochavada',
        loadComponent: () => import('./search/search.page').then((m) => m.SearchPage),
      },
      {
        path: 'reservar',
        title: 'Sus datos · Reserva',
        loadComponent: () => import('./checkout/checkout-details.page').then((m) => m.CheckoutDetailsPage),
      },
      {
        path: 'reservar/pago',
        title: 'Pago seguro · Reserva',
        loadComponent: () => import('./checkout/checkout-payment.page').then((m) => m.CheckoutPaymentPage),
      },
      {
        path: 'reserva/:code',
        title: 'Su reserva · Apartamentos Ochavada',
        loadComponent: () => import('./checkout/booking-status.page').then((m) => m.BookingStatusPage),
      },
      {
        path: 'mi-estancia',
        title: 'Mi estancia · Apartamentos Ochavada',
        loadComponent: () => import('./guest/guest-portal.page').then((m) => m.GuestPortalPage),
      },
      {
        path: 'condiciones',
        title: 'Condiciones de reserva · Apartamentos Ochavada',
        data: { kind: 'terms' },
        loadComponent: () => import('./legal/legal.page').then((m) => m.LegalPage),
      },
      {
        path: 'privacidad',
        title: 'Política de privacidad · Apartamentos Ochavada',
        data: { kind: 'privacy' },
        loadComponent: () => import('./legal/legal.page').then((m) => m.LegalPage),
      },
      {
        path: 'aviso-legal',
        title: 'Aviso legal · Apartamentos Ochavada',
        data: { kind: 'notice' },
        loadComponent: () => import('./legal/legal.page').then((m) => m.LegalPage),
      },
      {
        path: '**',
        title: 'Página no encontrada · Apartamentos Ochavada',
        loadComponent: () => import('./not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
