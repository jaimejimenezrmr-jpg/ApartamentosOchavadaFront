import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GuestApiService } from '../../core/api/guest-api.service';
import { problemMessage } from '../../core/api/problem';
import { GuestSessionService } from '../../core/auth/guest-session.service';
import { PAYMENT_MODE, RESERVATION_STATUS } from '../../shared/labels';
import { GuestDoorsComponent } from './guest-doors.component';
import { TravelersFormComponent } from '../../shared/travelers/travelers-form.component';

type Tab = 'stay' | 'travelers' | 'access';

/**
 * Portal «Mi estancia». El email de confirmación enlaza a `/mi-estancia#acceso=<token>`: el token va en el
 * fragmento para que no llegue a los registros del servidor ni a cabeceras Referer. Se canjea una vez por un
 * JWT de huésped y se elimina de la barra de direcciones.
 */
@Component({
  selector: 'app-guest-portal-page',
  imports: [CurrencyPipe, DatePipe, TravelersFormComponent, GuestDoorsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      @if (exchanging()) {
        <div class="loading"><span class="spinner" aria-label="Accediendo"></span></div>
      } @else if (!session.session()) {
        <section class="card stack intro">
          <h1>Mi estancia</h1>
          @if (exchangeError()) { <div class="alert alert--danger">{{ exchangeError() }}</div> }
          <p>Para acceder, abra el enlace personal que le enviamos por email al confirmar la reserva. Desde aquí podrá
            registrar a los viajeros, consultar los detalles de su estancia y abrir la puerta desde el móvil el día de llegada.</p>
          <p class="muted small">¿No encuentra el email? Revise la carpeta de correo no deseado o contacte con nosotros indicando su localizador.</p>
        </section>
      } @else {
        <header class="row row--between head">
          <div>
            <p class="muted small">Reserva {{ session.session()!.reservationCode }}</p>
            <h1>Mi estancia</h1>
          </div>
          <button type="button" class="btn btn--secondary btn--sm" (click)="logout()">Salir</button>
        </header>
        <nav class="tabs" aria-label="Secciones">
          <button type="button" [class.is-active]="tab() === 'stay'" (click)="tab.set('stay')">Reserva</button>
          <button type="button" [class.is-active]="tab() === 'travelers'" (click)="tab.set('travelers')">
            Registro de viajeros @if (stay.data() && !stay.data()!.onlineCheckinCompleted) { <span class="badge badge--warning">Pendiente</span> }
          </button>
          <button type="button" [class.is-active]="tab() === 'access'" (click)="tab.set('access')">Llegada y puertas</button>
        </nav>

        @switch (tab()) {
          @case ('stay') {
            @if (stay.isLoading()) {
              <div class="loading"><span class="spinner"></span></div>
            } @else if (stay.error()) {
              <div class="alert alert--danger">{{ stayError() }}</div>
            } @else if (stay.data(); as s) {
              <div class="grid-2">
                <section class="card">
                  <h2>{{ s.roomTypeName }}</h2>
                  <dl class="kv">
                    <dt>Titular</dt><dd>{{ s.holderName }}</dd>
                    <dt>Estado</dt><dd>{{ statusLabel[s.status] }}</dd>
                    <dt>Llegada</dt><dd>{{ s.checkIn | date: 'EEEE d MMMM y' }}, desde las {{ s.checkInTime.slice(0, 5) }}</dd>
                    <dt>Salida</dt><dd>{{ s.checkOut | date: 'EEEE d MMMM y' }}, antes de las {{ s.checkOutTime.slice(0, 5) }}</dd>
                    <dt>Huéspedes</dt><dd>{{ s.adults }} adultos@if (s.children) {, {{ s.children }} niños}</dd>
                    @if (s.roomNumber) { <dt>Apartamento</dt><dd>{{ s.roomNumber }}</dd> }
                  </dl>
                </section>
                <section class="card">
                  <h2>Pago</h2>
                  <dl class="kv">
                    <dt>Total</dt><dd>{{ s.totalAmount | currency: s.currency }}</dd>
                    <dt>Pagado</dt><dd>{{ s.paidAmount | currency: s.currency }}</dd>
                    <dt>Pendiente</dt><dd><strong>{{ s.pendingAmount | currency: s.currency }}</strong></dd>
                    <dt>Forma de pago</dt><dd>{{ paymentLabel[s.paymentMode] }}</dd>
                  </dl>
                </section>
                <section class="card">
                  <h2>Contacto</h2>
                  <p><strong>{{ s.property.name }}</strong></p>
                  @if (s.property.address) { <p class="muted">{{ s.property.address }}</p> }
                  @if (s.property.phone) { <p><a [href]="'tel:' + s.property.phone">{{ s.property.phone }}</a></p> }
                  @if (s.property.email) { <p><a [href]="'mailto:' + s.property.email">{{ s.property.email }}</a></p> }
                </section>
                @if (!s.onlineCheckinCompleted) {
                  <section class="card alert--warning">
                    <h2>Registro de viajeros pendiente</h2>
                    <p>La ley exige registrar a todos los viajeros antes de entregar el acceso. Hágalo ahora y ahórrese esperas a la llegada.</p>
                    <button type="button" class="btn" (click)="tab.set('travelers')">Registrar viajeros</button>
                  </section>
                }
              </div>
            }
          }
          @case ('travelers') {
            <app-travelers-form (saved)="stay.reload()" />
          }
          @case ('access') {
            <app-guest-doors (checkedIn)="stay.reload()" />
          }
        }
      }
    </div>
  `,
  styles: `
    .page { padding-top: 24px; }
    .intro { max-width: 720px; }
    .head h1 { margin: 0; }
    .head p { margin: 0; }
  `,
})
export class GuestPortalPage implements OnInit {
  private readonly api = inject(GuestApiService);
  protected readonly session = inject(GuestSessionService);
  protected readonly statusLabel = RESERVATION_STATUS;
  protected readonly paymentLabel = PAYMENT_MODE;

  protected readonly tab = signal<Tab>('stay');
  protected readonly exchanging = signal(false);
  protected readonly exchangeError = signal<string | null>(null);

  protected readonly stay = apiResource({
    params: () => this.session.session()?.reservationCode,
    stream: () => this.api.stay(),
  });
  protected readonly stayError = computed(() => problemMessage(this.stay.error()));

  ngOnInit(): void {
    const match = /(?:^#|&)acceso=([^&]+)/.exec(window.location.hash);
    if (match) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      void this.exchange(decodeURIComponent(match[1]));
    }
  }

  private async exchange(token: string): Promise<void> {
    this.exchanging.set(true);
    this.exchangeError.set(null);
    try {
      this.session.store(await firstValueFrom(this.api.exchange(token)));
    } catch (error) {
      this.session.clear();
      this.exchangeError.set(`El enlace no es válido o ha caducado. ${problemMessage(error)}`);
    } finally {
      this.exchanging.set(false);
    }
  }

  protected logout(): void {
    this.session.clear();
  }
}
