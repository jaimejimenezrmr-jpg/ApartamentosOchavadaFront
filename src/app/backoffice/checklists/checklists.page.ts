import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { ChecklistItem, ChecklistTemplate } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { useAction } from '../../shared/ui/action';
import { apiResource } from '../../shared/ui/api-resource';

interface Draft {
  id: string | null;
  name: string;
  roomTypeId: string;
  active: boolean;
  items: ChecklistItem[];
  version: number;
}

/**
 * Listas de comprobación de limpieza (solo administración). Cada tipo de apartamento puede tener la suya; si no,
 * se usa la general. Los puntos con «foto» obligan a adjuntar una foto para terminar la limpieza.
 */
@Component({
  selector: 'app-checklists-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between">
      <h1>Listas de limpieza</h1>
      <button type="button" class="btn" (click)="startCreate()">Nueva lista</button>
    </div>
    <p class="muted small">
      Al empezar una limpieza se copia la lista del tipo de apartamento (o la general). Cambiarla después no altera
      las limpiezas ya empezadas. Pocas fotos, pero las justas para comprobar a distancia: cama, baño, cocina, estado general.
    </p>

    @if (draft(); as d) {
      <form class="card stack" (ngSubmit)="save(d)">
        <h3>{{ d.id ? 'Editar lista' : 'Nueva lista' }}</h3>
        <div class="grid-3">
          <div class="field"><label for="cl-name">Nombre *</label>
            <input id="cl-name" name="name" [(ngModel)]="d.name" maxlength="120" required placeholder="p. ej. Limpieza de salida"></div>
          <div class="field"><label for="cl-type">Se aplica a</label>
            <select id="cl-type" name="type" [(ngModel)]="d.roomTypeId">
              <option value="">Todos los apartamentos (general)</option>
              @for (t of roomTypes.data() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
            </select></div>
          <label class="check active"><input type="checkbox" name="active" [(ngModel)]="d.active"> Activa</label>
        </div>

        <table class="table items">
          <thead><tr><th>Zona</th><th>Punto a comprobar</th><th>Foto</th><th></th></tr></thead>
          <tbody>
            @for (item of d.items; track $index; let i = $index; let first = $first; let last = $last) {
              <tr>
                <td><input [name]="'section' + i" [(ngModel)]="item.section" maxlength="60" placeholder="Dormitorio" aria-label="Zona"></td>
                <td><input [name]="'label' + i" [(ngModel)]="item.label" maxlength="200" required placeholder="Cama hecha con ropa limpia" aria-label="Punto"></td>
                <td class="center"><input type="checkbox" [name]="'photo' + i" [(ngModel)]="item.photoRequired" aria-label="Foto obligatoria"></td>
                <td class="right nowrap">
                  <button type="button" class="btn btn--ghost btn--sm" [disabled]="first" (click)="move(d, i, -1)" aria-label="Subir">↑</button>
                  <button type="button" class="btn btn--ghost btn--sm" [disabled]="last" (click)="move(d, i, 1)" aria-label="Bajar">↓</button>
                  <button type="button" class="btn btn--ghost btn--sm" [disabled]="d.items.length === 1" (click)="remove(d, i)" aria-label="Quitar">✕</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <div class="row row--between">
          <button type="button" class="btn btn--secondary btn--sm" (click)="add(d)">Añadir punto</button>
          <div class="row">
            <button type="button" class="btn btn--secondary btn--sm" (click)="draft.set(null)">Cancelar</button>
            <button type="submit" class="btn btn--sm" [disabled]="action.busy() || !valid(d)">Guardar</button>
          </div>
        </div>
      </form>
    }

    @if (templates.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else {
      <section class="card table-wrap">
        <table class="table">
          <thead><tr><th>Lista</th><th>Se aplica a</th><th>Puntos</th><th>Con foto</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (t of templates.data() ?? []; track t.id) {
              <tr [class.is-off]="!t.active">
                <td><strong>{{ t.name }}</strong></td>
                <td>{{ t.roomTypeName ?? 'General' }}</td>
                <td>{{ t.items.length }}</td>
                <td>{{ photoCount(t) }}</td>
                <td><span class="badge badge--{{ t.active ? 'success' : 'neutral' }}">{{ t.active ? 'Activa' : 'Inactiva' }}</span></td>
                <td class="right"><button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(t)">Editar</button></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty">@if (templates.isLoading()) { Cargando… } @else { Aún no hay listas: las limpiezas se terminan sin lista. }</td></tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    .active { align-self: end; padding-bottom: 8px; }
    .items input[type='text'], .items input:not([type]) { width: 100%; }
    .center { text-align: center; }
    tr.is-off td { color: var(--c-text-muted); }
  `,
})
export class ChecklistsPage {
  private readonly api = inject(AdminApiService);
  protected readonly action = useAction();
  protected readonly templates = apiResource({ stream: () => this.api.checklists() });
  protected readonly roomTypes = apiResource({ stream: () => this.api.roomTypes() });
  protected readonly error = computed(() => problemMessage(this.templates.error()));
  protected readonly draft = signal<Draft | null>(null);

  protected photoCount(t: ChecklistTemplate): number {
    return t.items.filter((i) => i.photoRequired).length;
  }

  protected startCreate(): void {
    this.draft.set({
      id: null,
      name: 'Limpieza de salida',
      roomTypeId: '',
      active: true,
      version: 0,
      items: [
        { section: 'Dormitorio', label: 'Cama hecha con ropa limpia', photoRequired: true },
        { section: 'Dormitorio', label: 'Suelos y superficies sin polvo', photoRequired: false },
        { section: 'Baño', label: 'Baño limpio y desinfectado', photoRequired: true },
        { section: 'Baño', label: 'Toallas y amenities repuestos', photoRequired: false },
        { section: 'Cocina', label: 'Cocina, menaje y frigorífico limpios', photoRequired: true },
        { section: 'General', label: 'Basura retirada y ventanas cerradas', photoRequired: false },
        { section: 'General', label: 'Estado general', photoRequired: true },
      ],
    });
  }

  protected startEdit(t: ChecklistTemplate): void {
    this.draft.set({
      id: t.id,
      name: t.name,
      roomTypeId: t.roomTypeId ?? '',
      active: t.active,
      version: t.version,
      items: t.items.map((i) => ({ section: i.section, label: i.label, photoRequired: i.photoRequired })),
    });
  }

  protected add(d: Draft): void {
    d.items.push({ section: d.items.at(-1)?.section ?? null, label: '', photoRequired: false });
    this.draft.set({ ...d });
  }

  protected remove(d: Draft, index: number): void {
    d.items.splice(index, 1);
    this.draft.set({ ...d });
  }

  protected move(d: Draft, index: number, delta: number): void {
    const [item] = d.items.splice(index, 1);
    d.items.splice(index + delta, 0, item);
    this.draft.set({ ...d });
  }

  protected valid(d: Draft): boolean {
    return !!d.name.trim() && d.items.length > 0 && d.items.every((i) => i.label.trim());
  }

  protected async save(d: Draft): Promise<void> {
    const request = {
      name: d.name.trim(),
      roomTypeId: d.roomTypeId || null,
      active: d.active,
      items: d.items.map((i) => ({ section: i.section?.trim() || null, label: i.label.trim(), photoRequired: i.photoRequired })),
      version: d.id ? d.version : undefined,
    };
    const saved = await this.action.run(
      () => (d.id ? this.api.updateChecklist(d.id, request) : this.api.createChecklist(request)),
      'Lista guardada',
    );
    if (saved) {
      this.draft.set(null);
      this.templates.reload();
    }
  }
}
