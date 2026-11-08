import { apiResource } from '../../shared/ui/api-resource';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { RoomRequest, RoomResponse, RoomStatus } from '../../core/api/models';
import { HOUSEKEEPING_STATUS, ROOM_STATUS } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

type Draft = RoomRequest & { id: string | null };

@Component({
  selector: 'app-rooms',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between"><h2>Unidades</h2><button type="button" class="btn btn--sm" (click)="startCreate()">Nueva unidad</button></div>
    <section class="card table-wrap">
      <table class="table">
        <thead><tr><th>Número</th><th>Tipología</th><th>Planta</th><th>Estado</th><th>Limpieza</th><th>Unidad Beds24</th><th></th></tr></thead>
        <tbody>
          @for (r of rooms.data() ?? []; track r.id) {
            <tr>
              <td><strong>{{ r.number }}</strong>@if (r.name) { <span class="small muted"> · {{ r.name }}</span> }</td>
              <td>{{ r.roomTypeName }}</td><td>{{ r.floor ?? '—' }}</td><td>{{ statusLabel[r.status] }}</td>
              <td>{{ hkLabel[r.housekeepingStatus] }}</td><td>{{ r.beds24UnitId ?? '—' }}</td>
              <td class="right"><button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(r)">Editar</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">Aún no hay unidades.</td></tr> }
        </tbody>
      </table>
    </section>
    @if (draft(); as d) {
      <form class="card stack" (ngSubmit)="save(d)">
        <h3>{{ d.id ? 'Editar unidad ' + d.number : 'Nueva unidad' }}</h3>
        <div class="grid-3">
          <div class="field"><label for="rm-type">Tipología *</label>
            <select id="rm-type" name="type" [(ngModel)]="d.roomTypeId" required>
              <option value="">—</option>
              @for (t of types.data() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
            </select></div>
          <div class="field"><label for="rm-num">Número *</label><input id="rm-num" name="num" [(ngModel)]="d.number" maxlength="10" required></div>
          <div class="field"><label for="rm-name">Nombre</label><input id="rm-name" name="name" [(ngModel)]="d.name" maxlength="100"></div>
          <div class="field"><label for="rm-floor">Planta</label><input id="rm-floor" type="number" name="floor" [(ngModel)]="d.floor"></div>
          <div class="field"><label for="rm-st">Estado</label>
            <select id="rm-st" name="st" [(ngModel)]="d.status">
              @for (s of statuses; track s) { <option [value]="s">{{ statusLabel[s] }}</option> }
            </select></div>
          <div class="field"><label for="rm-b24">Unidad Beds24</label><input id="rm-b24" type="number" min="1" name="b24" [(ngModel)]="d.beds24UnitId"></div>
        </div>
        <div class="field"><label for="rm-notes">Notas</label><textarea id="rm-notes" name="notes" [(ngModel)]="d.notes"></textarea></div>
        <p class="small muted">Una unidad con reservas o histórico no puede eliminarse: márquela como inactiva.</p>
        <div class="row row--end">
          @if (d.id) { <button type="button" class="btn btn--ghost btn--sm" (click)="remove(d.id)">Eliminar</button> }
          <button type="button" class="btn btn--secondary btn--sm" (click)="draft.set(null)">Cerrar</button>
          <button type="submit" class="btn btn--sm" [disabled]="action.busy()">Guardar</button>
        </div>
      </form>
    }
  `,
})
export class RoomsComponent {
  private readonly api = inject(AdminApiService);
  private readonly backoffice = inject(BackofficeApiService);
  protected readonly action = useAction();
  protected readonly statusLabel = ROOM_STATUS;
  protected readonly hkLabel = HOUSEKEEPING_STATUS;
  protected readonly statuses: RoomStatus[] = ['ACTIVE', 'OUT_OF_ORDER', 'INACTIVE'];

  protected readonly rooms = apiResource({ stream: () => this.backoffice.rooms() });
  protected readonly types = apiResource({ stream: () => this.api.roomTypes() });
  protected readonly draft = signal<Draft | null>(null);

  protected startCreate(): void {
    this.draft.set({ id: null, version: null, roomTypeId: '', number: '', name: null, floor: null, status: 'ACTIVE', beds24UnitId: null, notes: null });
  }

  protected startEdit(r: RoomResponse): void {
    this.draft.set({
      id: r.id, version: r.version, roomTypeId: r.roomTypeId, number: r.number, name: r.name, floor: r.floor,
      status: r.status, beds24UnitId: r.beds24UnitId, notes: r.notes,
    });
  }

  protected async save(d: Draft): Promise<void> {
    const request: RoomRequest = {
      roomTypeId: d.roomTypeId,
      number: d.number.trim(),
      name: d.name?.trim() || null,
      floor: d.floor === null || (d.floor as unknown) === '' ? null : Number(d.floor),
      status: d.status,
      beds24UnitId: d.beds24UnitId === null || (d.beds24UnitId as unknown) === '' ? null : Number(d.beds24UnitId),
      notes: d.notes?.trim() || null,
      version: d.version,
    };
    const saved = await this.action.run(() => (d.id ? this.api.updateRoom(d.id, request) : this.api.createRoom(request)), 'Unidad guardada');
    if (saved) {
      this.draft.set(null);
      this.rooms.reload();
    }
  }

  protected async remove(id: string): Promise<void> {
    if (await this.action.runOk(() => this.api.deleteRoom(id), 'Unidad eliminada')) {
      this.draft.set(null);
      this.rooms.reload();
    }
  }
}
