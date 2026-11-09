import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { LostItemResponse, LostItemStatus } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { elapsedSince } from '../../core/util/dates';
import { LOST_ITEM_STATUS } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';
import { apiResource } from '../../shared/ui/api-resource';
import { PhotoButtonComponent } from '../../shared/ui/photo-button.component';
import { ProtectedImageComponent } from '../../shared/ui/protected-image.component';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * Objetos olvidados: qué se encontró, dónde está guardado y de quién es (la reserva se vincula sola). Recepción
 * avisa al huésped y cierra el expediente: enviado, recogido o desechado.
 */
@Component({
  selector: 'app-lost-items-page',
  imports: [DatePipe, FormsModule, RouterLink, PhotoButtonComponent, ProtectedImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between head">
      <h1>Objetos olvidados</h1>
      <div class="row">
        <label class="check"><input type="checkbox" [ngModel]="openOnly()" (ngModelChange)="openOnly.set($event)"> Solo pendientes</label>
        <button type="button" class="btn btn--sm" (click)="creating.set(!creating())">{{ creating() ? 'Cancelar' : 'Registrar objeto' }}</button>
      </div>
    </div>

    @if (creating()) {
      <form class="card stack" (ngSubmit)="create()">
        <div class="grid-3">
          <div class="field"><label for="nl-room">Unidad *</label>
            <select id="nl-room" name="room" [(ngModel)]="newRoom" required>
              <option value="">Unidad…</option>
              @for (r of rooms.data() ?? []; track r.roomId) { <option [value]="r.roomId">{{ r.number }}{{ r.name ? ' · ' + r.name : '' }}</option> }
            </select></div>
          <div class="field"><label for="nl-desc">Objeto *</label>
            <input id="nl-desc" name="desc" [(ngModel)]="newDescription" maxlength="300" required></div>
          <div class="field"><label for="nl-where">Dónde se guarda</label>
            <input id="nl-where" name="where" [(ngModel)]="newLocation" maxlength="120"></div>
        </div>
        <div class="row row--end">
          <app-photo-button [label]="newPhoto() ? '📷 Cambiar foto' : '📷 Añadir foto'" (picked)="newPhoto.set($event)" />
          <button type="submit" class="btn btn--sm" [disabled]="action.busy() || !newRoom || !newDescription.trim()">Registrar</button>
        </div>
      </form>
    }

    @if (list.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else {
      <div class="items">
        @for (l of list.data() ?? []; track l.id) {
          <article class="card item">
            <div class="row row--between">
              <strong>{{ l.description }}</strong>
              <span class="badge badge--{{ l.status === 'STORED' ? 'warning' : l.status === 'GUEST_NOTIFIED' ? 'info' : 'neutral' }}">{{ statusLabel[l.status] }}</span>
            </div>
            <p class="small muted">{{ l.code }} · unidad {{ l.roomNumber ?? '—' }} · encontrado {{ l.foundAt | date: 'd MMM, HH:mm' }} (hace {{ ago(l) }})@if (l.foundByName) { por {{ l.foundByName }} }</p>
            @if (l.reservationId) {
              <p class="small">
                Huésped: <a [routerLink]="['/backoffice/reservas', l.reservationId]">{{ l.guestName }} · {{ l.reservationCode }}</a>
                @if (l.guestPhone) { · <a [href]="'tel:' + l.guestPhone">{{ l.guestPhone }}</a> }
                @if (l.guestEmail) { · <a [href]="'mailto:' + l.guestEmail">{{ l.guestEmail }}</a> }
              </p>
            } @else {
              <p class="small muted">Sin reserva asociada.</p>
            }
            <div class="row photos">
              @for (p of l.photos; track p.id) { <app-protected-image [mediaId]="p.id" [alt]="l.description" /> }
              @if (isOpen(l)) { <app-photo-button (picked)="addPhoto(l, $event)" /> }
            </div>
            @if (isOpen(l)) {
              <div class="row">
                <input class="grow" [ngModel]="l.storageLocation ?? ''" (blur)="saveLocation(l, $any($event.target).value)"
                       maxlength="120" placeholder="Dónde se guarda" aria-label="Dónde se guarda">
              </div>
              <div class="row actions">
                @if (l.status === 'STORED') { <button type="button" class="btn btn--secondary btn--sm" [disabled]="action.busy()" (click)="move(l, 'GUEST_NOTIFIED')">Huésped avisado</button> }
                <button type="button" class="btn btn--sm" [disabled]="action.busy()" (click)="move(l, 'SHIPPED')">Enviado</button>
                <button type="button" class="btn btn--sm" [disabled]="action.busy()" (click)="move(l, 'COLLECTED')">Recogido</button>
                <button type="button" class="btn btn--ghost btn--sm" [disabled]="action.busy()" (click)="move(l, 'DISCARDED')">Desechado</button>
              </div>
            } @else if (l.storageLocation) {
              <p class="small muted">Guardado en: {{ l.storageLocation }}</p>
            }
          </article>
        } @empty {
          <p class="empty">@if (list.isLoading()) { Cargando… } @else { No hay objetos {{ openOnly() ? 'pendientes' : 'registrados' }}. }</p>
        }
      </div>
    }
  `,
  styles: `
    .head { margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
    .head h1 { margin: 0; }
    .items { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); align-items: start; }
    .item { margin: 0 !important; display: flex; flex-direction: column; gap: 8px; }
    .item p { margin: 0; }
    .photos { gap: 8px; align-items: center; }
    .actions { flex-wrap: wrap; }
  `,
})
export class LostItemsPage {
  private readonly api = inject(BackofficeApiService);
  private readonly toast = inject(ToastService);
  protected readonly action = useAction();
  protected readonly statusLabel = LOST_ITEM_STATUS;

  protected readonly openOnly = signal(true);
  protected readonly list = apiResource({ params: () => this.openOnly(), stream: ({ params }) => this.api.lostItems(params) });
  protected readonly rooms = apiResource({ stream: () => this.api.housekeepingRooms() });
  protected readonly error = computed(() => problemMessage(this.list.error()));

  protected readonly creating = signal(false);
  protected newRoom = '';
  protected newDescription = '';
  protected newLocation = '';
  protected readonly newPhoto = signal<Blob | null>(null);

  protected isOpen(l: LostItemResponse): boolean {
    return l.status === 'STORED' || l.status === 'GUEST_NOTIFIED';
  }

  protected ago(l: LostItemResponse): string {
    return elapsedSince(l.foundAt);
  }

  protected async create(): Promise<void> {
    const photo = this.newPhoto();
    const created = await this.action.run(() => this.api.createLostItem({
      roomId: this.newRoom,
      taskId: null,
      description: this.newDescription.trim(),
      storageLocation: this.newLocation.trim() || null,
    }), (l) => `Objeto ${l.code} registrado`);
    if (!created) return;
    if (photo) {
      try {
        await firstValueFrom(this.api.uploadLostItemPhoto(created.id, photo));
      } catch (e) {
        this.toast.error(`Registrado, pero la foto no se pudo subir: ${problemMessage(e)}`);
      }
    }
    this.newRoom = '';
    this.newDescription = '';
    this.newLocation = '';
    this.newPhoto.set(null);
    this.creating.set(false);
    this.list.reload();
  }

  protected async move(l: LostItemResponse, status: LostItemStatus): Promise<void> {
    if (await this.action.run(() => this.api.changeLostItemStatus(l.id, status, l.version), `${l.code}: ${LOST_ITEM_STATUS[status]}`)) {
      this.list.reload();
    }
  }

  protected async saveLocation(l: LostItemResponse, value: string): Promise<void> {
    const location = value.trim() || null;
    if (location === (l.storageLocation ?? null)) return;
    if (await this.action.run(() => this.api.updateLostItem(l.id, location, l.notes, l.version), 'Ubicación guardada')) this.list.reload();
  }

  protected async addPhoto(l: LostItemResponse, photo: Blob): Promise<void> {
    if (await this.action.run(() => this.api.uploadLostItemPhoto(l.id, photo), 'Foto añadida')) this.list.reload();
  }
}
