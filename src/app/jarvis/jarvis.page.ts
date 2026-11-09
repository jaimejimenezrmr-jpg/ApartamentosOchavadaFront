import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackofficeApiService } from '../core/api/backoffice-api.service';
import { DashboardResponse } from '../core/api/models';
import { StaffSessionService } from '../core/auth/staff-session.service';
import { apiResource } from '../shared/ui/api-resource';

type Tone = 'danger' | 'warning' | 'info';

interface Badge {
  value: number;
  label: string;
  tone: Tone;
}

interface Screen {
  icon: string;
  title: string;
  description: string;
  link: string;
  query?: Record<string, string>;
  keywords?: string;
  badge?: (d: DashboardResponse) => Badge | null;
}

interface Group {
  title: string;
  screens: Screen[];
}

/** Aviso solo si hay algo que atender. */
function badge(value: number, label: string, tone: Tone): Badge | null {
  return value > 0 ? { value, label, tone } : null;
}

/**
 * Todas las pantallas de gestión del administrador, agrupadas por área. Los avisos de cada botón salen del
 * panel del día: así se ve de un vistazo dónde hay algo pendiente.
 */
const GROUPS: Group[] = [
  {
    title: 'Hoy',
    screens: [
      {
        icon: '📊', title: 'Panel del día', link: '/backoffice/panel', keywords: 'dashboard resumen ocupacion ingresos',
        description: 'Ocupación, ingresos, llegadas, salidas y excepciones operativas.',
        badge: (d) => {
          const o = d.operations;
          const urgent = o.openIncidentsP1 + o.arrivalsNotReady;
          return urgent ? badge(urgent, 'urgente(s)', 'danger') : badge(o.overdueTasks + o.openIncidentsP2, 'a revisar', 'warning');
        },
      },
      {
        icon: '🗓️', title: 'Rack', link: '/backoffice/rack', keywords: 'calendario disponibilidad asignar unidades bloqueos',
        description: 'Calendario de unidades: asignar, mover reservas y bloquear fechas.',
        badge: (d) => badge(d.unassignedArrivals, 'llegada(s) sin unidad', 'warning'),
      },
      {
        icon: '📋', title: 'Reservas', link: '/backoffice/reservas', keywords: 'buscar localizador check-in check-out cobros',
        description: 'Buscar, consultar y gestionar reservas: check-in, check-out y cobros.',
        badge: (d) => badge(d.pendingPaymentHolds, 'esperando pago', 'info'),
      },
      {
        icon: '➕', title: 'Nueva reserva', link: '/backoffice/reservas/nueva', keywords: 'telefono mostrador alta manual',
        description: 'Reserva por teléfono, en mostrador o de otro canal.',
      },
      {
        icon: '👤', title: 'Huéspedes', link: '/backoffice/huespedes', keywords: 'clientes fichas historial',
        description: 'Fichas de huéspedes y su historial de estancias.',
      },
    ],
  },
  {
    title: 'Operaciones',
    screens: [
      {
        icon: '🧹', title: 'Limpieza', link: '/backoffice/limpieza', keywords: 'housekeeping tareas inspeccion estado unidades',
        description: 'Tablero de limpieza, inspección y estado de cada apartamento.',
        badge: (d) => d.operations.overdueTasks
          ? badge(d.operations.overdueTasks, 'fuera de hora', 'warning')
          : badge(d.operations.tasksAwaitingInspection, 'por inspeccionar', 'info'),
      },
      {
        icon: '⚠️', title: 'Incidencias', link: '/backoffice/incidencias', keywords: 'averias mantenimiento problemas p1 p2',
        description: 'Centro de incidencias por prioridad (P1 emergencia … P4 mejora).',
        badge: (d) => badge(d.operations.openIncidents, 'abierta(s)',
          d.operations.openIncidentsP1 ? 'danger' : d.operations.openIncidentsP2 ? 'warning' : 'info'),
      },
      {
        icon: '🧳', title: 'Objetos olvidados', link: '/backoffice/objetos-olvidados', keywords: 'perdidos huesped devolver',
        description: 'Objetos encontrados, su ubicación y la devolución al huésped.',
        badge: (d) => badge(d.operations.openLostItems, 'pendiente(s)', 'info'),
      },
      {
        icon: '🔐', title: 'Cerraduras', link: '/backoffice/cerraduras', keywords: 'ttlock puertas apertura bateria accesos',
        description: 'Cerraduras TTLock: apertura remota, batería y registro de accesos.',
        badge: (d) => badge(d.operations.locksLowBattery, 'batería baja', 'warning'),
      },
      {
        icon: '✅', title: 'Listas de limpieza', link: '/backoffice/listas-limpieza', keywords: 'checklist plantillas fotos',
        description: 'Listas de comprobación por tipo de apartamento, con fotos obligatorias.',
      },
    ],
  },
  {
    title: 'Comercial y catálogo',
    screens: [
      {
        icon: '💶', title: 'Tarifas', link: '/backoffice/tarifas', keywords: 'precios temporadas calendario restricciones',
        description: 'Calendario de precios, temporadas y estancias mínimas.',
      },
      {
        icon: '🏠', title: 'Tipologías', link: '/backoffice/catalogo', query: { seccion: 'tipologias' }, keywords: 'tipos apartamento fotos descripcion',
        description: 'Tipos de apartamento: descripción, capacidad, fotos y precio «desde».',
      },
      {
        icon: '🚪', title: 'Unidades', link: '/backoffice/catalogo', query: { seccion: 'unidades' }, keywords: 'apartamentos habitaciones numeros a01',
        description: 'Cada apartamento físico (A01 «La Torre»…), planta y estado.',
      },
      {
        icon: '🏷️', title: 'Planes de tarifa', link: '/backoffice/catalogo', query: { seccion: 'planes' }, keywords: 'flexible no reembolsable cancelacion',
        description: 'Flexible, no reembolsable…: condiciones de cancelación y pago.',
      },
      {
        icon: '📶', title: 'Servicios', link: '/backoffice/catalogo', query: { seccion: 'servicios' }, keywords: 'amenities wifi equipamiento',
        description: 'Equipamiento que se muestra en la web (Wi-Fi, climatización, cocina…).',
      },
      {
        icon: '🔗', title: 'Channel manager', link: '/backoffice/canal', keywords: 'beds24 booking airbnb sincronizacion',
        description: 'Conexión con Beds24: sincronización con Booking, Airbnb y Expedia.',
      },
    ],
  },
  {
    title: 'Facturación y obligaciones legales',
    screens: [
      {
        icon: '🧾', title: 'Facturas', link: '/backoffice/facturas', keywords: 'facturacion rectificativas verifactu',
        description: 'Facturas emitidas, rectificativas y registro VERI*FACTU.',
      },
      {
        icon: '🛂', title: 'SES.HOSPEDAJES', link: '/backoffice/ses', keywords: 'ministerio interior partes viajeros policia',
        description: 'Comunicaciones de reservas y partes de viajeros al Ministerio del Interior.',
        badge: (d) => d.sesReportsOverdue
          ? badge(d.sesReportsOverdue, 'fuera de plazo', 'danger')
          : badge(d.sesReportsNeedingAction, 'requieren atención', 'warning'),
      },
    ],
  },
  {
    title: 'Equipo y cuenta',
    screens: [
      {
        icon: '👥', title: 'Usuarios', link: '/backoffice/usuarios', keywords: 'personal equipo perfiles permisos contraseñas',
        description: 'Altas del equipo, perfiles, contraseñas temporales y sesiones.',
      },
      {
        icon: '🙋', title: 'Mi cuenta', link: '/backoffice/cuenta', keywords: 'contraseña perfil',
        description: 'Sus datos y el cambio de contraseña.',
      },
      {
        icon: '🌐', title: 'Web pública', link: '/', keywords: 'pagina reservas online clientes',
        description: 'La web que ven los huéspedes: apartamentos y reserva directa.',
      },
    ],
  },
];

/** Minúsculas y sin tildes: «tipologias» encuentra «Tipologías» y «ses», «SES.HOSPEDAJES». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-jarvis-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="top">
      <div class="top__inner">
        <div class="brand">
          <span class="brand__mark" aria-hidden="true">J</span>
          <div>
            <h1>Jarvis</h1>
            <p>Centro de control · Apartamentos Ochavada</p>
          </div>
        </div>
        <div class="who">
          <span>{{ session.user()?.fullName }}</span>
          <a routerLink="/backoffice/panel" class="btn btn--secondary btn--sm">Backoffice</a>
          <button type="button" class="btn btn--ghost btn--sm on-dark" (click)="session.logout()">Cerrar sesión</button>
        </div>
      </div>
    </header>

    <main class="wrap">
      <p class="today">{{ today | date: "EEEE d 'de' MMMM" }}</p>

      @if (data.data(); as d) {
        <div class="kpis">
          <div class="kpi"><span>Ocupación</span><strong>{{ d.occupancyPercent | number: '1.0-0' }} %</strong><small>{{ d.occupiedRooms }} de {{ d.activeRooms }}</small></div>
          <div class="kpi"><span>Llegadas</span><strong>{{ d.arrivals.length }}</strong><small>hoy</small></div>
          <div class="kpi"><span>Salidas</span><strong>{{ d.departures.length }}</strong><small>hoy</small></div>
          <div class="kpi"><span>En casa</span><strong>{{ d.inHouse }}</strong><small>reservas alojadas</small></div>
          <div class="kpi"><span>Ingresos del mes</span><strong>{{ d.revenueMonthToDate | currency: d.currency: 'symbol': '1.0-0' }}</strong><small>alojamiento</small></div>
        </div>
      } @else if (data.error()) {
        <p class="small muted">No se pudo cargar el resumen del día; los accesos funcionan igualmente.</p>
      }

      <div class="search">
        <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" (keydown.enter)="enter()"
               placeholder="Buscar pantalla o escribir un localizador (OCH-…)" aria-label="Buscar pantalla o localizador">
      </div>

      @for (g of groups(); track g.title) {
        <section class="group" [attr.aria-label]="g.title">
          <h2>{{ g.title }}</h2>
          <div class="grid">
            @for (s of g.screens; track s.title) {
              <a class="tile" [routerLink]="s.link" [queryParams]="s.query ?? null">
                <span class="tile__icon" aria-hidden="true">{{ s.icon }}</span>
                <span class="tile__body">
                  <strong>{{ s.title }}</strong>
                  <span>{{ s.description }}</span>
                </span>
                @if (badgeOf(s); as b) {
                  <span class="tile__badge tile__badge--{{ b.tone }}" [attr.aria-label]="b.value + ' ' + b.label">{{ b.value }} {{ b.label }}</span>
                }
              </a>
            }
          </div>
        </section>
      } @empty {
        <p class="empty">Ninguna pantalla coincide con «{{ query() }}». Pulse Intro para buscarlo como localizador de reserva.</p>
      }
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--c-bg); }
    .top { background: #2b211c; color: #f4eee7; }
    .top__inner { max-width: 1180px; margin: 0 auto; padding: 18px 20px; display: flex; justify-content: space-between;
      align-items: center; gap: 16px; flex-wrap: wrap; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand__mark { width: 46px; height: 46px; border-radius: 50%; background: var(--c-brand); color: #fff; display: grid;
      place-items: center; font: 600 1.4rem var(--font-display); }
    .brand h1 { margin: 0; color: #fff; font-size: 1.6rem; }
    .brand p { margin: 0; color: #b9ab9e; font-size: 0.9rem; }
    .who { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .who > span { color: #d9cfc4; font-weight: 500; }
    .on-dark { color: #f4eee7; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 20px; }
    .today { margin: 0 0 12px; color: var(--c-text-muted); font-weight: 500; }
    .today::first-letter { text-transform: uppercase; }
    .kpis { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 18px; }
    .kpi { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); padding: 12px 14px;
      display: flex; flex-direction: column; gap: 2px; }
    .kpi span { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--c-text-muted); }
    .kpi strong { font: 600 1.5rem var(--font-display); }
    .kpi small { color: var(--c-text-muted); }
    .search input { width: 100%; min-height: 46px; font-size: 1rem; padding: 10px 14px; }
    .group h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-muted); margin: 26px 0 10px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
    .tile { position: relative; display: flex; gap: 12px; align-items: flex-start; padding: 16px; background: var(--c-surface);
      border: 1px solid var(--c-border); border-radius: var(--radius); text-decoration: none; color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; min-height: 96px; }
    .tile:hover, .tile:focus-visible { border-color: var(--c-brand); box-shadow: 0 6px 18px rgba(43, 33, 28, 0.1); transform: translateY(-1px); }
    .tile__icon { font-size: 1.7rem; line-height: 1; flex: 0 0 auto; }
    .tile__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .tile__body strong { font: 600 1.05rem var(--font-display); }
    .tile__body span { font-size: 0.86rem; color: var(--c-text-muted); }
    .tile__badge { position: absolute; top: 10px; right: 10px; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
    .tile__badge--danger { background: var(--c-danger-soft); color: var(--c-danger); }
    .tile__badge--warning { background: var(--c-warning-soft); color: var(--c-warning); }
    .tile__badge--info { background: var(--c-info-soft); color: var(--c-info); }
    .tile:has(.tile__badge) .tile__body { padding-right: 70px; }
    @media (max-width: 600px) {
      .top__inner, .wrap { padding-left: 16px; padding-right: 16px; }
      .tile:has(.tile__badge) .tile__body { padding-right: 0; padding-top: 18px; }
    }
  `,
})
export class JarvisPage {
  protected readonly session = inject(StaffSessionService);
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  protected readonly today = new Date();
  protected readonly data = apiResource({ stream: () => this.api.dashboard() });
  protected readonly query = signal('');

  protected readonly groups = computed<Group[]>(() => {
    const q = normalize(this.query().trim());
    if (!q) return GROUPS;
    return GROUPS
      .map((g) => ({
        ...g,
        screens: g.screens.filter((s) => normalize(`${s.title} ${s.description} ${s.keywords ?? ''} ${g.title}`).includes(q)),
      }))
      .filter((g) => g.screens.length > 0);
  });

  protected badgeOf(s: Screen): Badge | null {
    const d = this.data.data();
    return d && s.badge ? s.badge(d) : null;
  }

  /**
   * Intro: abre la pantalla cuyo título coincide (o la única que queda); un texto con aspecto de localizador
   * (con cifras o «OCH-…») se busca en las reservas.
   */
  protected enter(): void {
    const text = this.query().trim();
    if (!text) return;
    const q = normalize(text);
    const matches = this.groups().flatMap((g) => g.screens);
    const byTitle = matches.find((s) => normalize(s.title).startsWith(q));
    const looksLikeCode = /\d/.test(text) || /^[a-z]{2,4}-/i.test(text);
    const target = byTitle ?? (!looksLikeCode && matches.length ? matches[0] : null);
    if (target) {
      void this.router.navigate([target.link], { queryParams: target.query ?? {} });
    } else {
      void this.router.navigate(['/backoffice/reservas'], { queryParams: { q: text.toUpperCase() } });
    }
  }
}
