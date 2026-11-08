import { apiResource } from '../../shared/ui/api-resource';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { Amenity, AmenityCategory, AmenityRequest } from '../../core/api/models';
import { AMENITY_CATEGORY } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

type Draft = AmenityRequest & { id: string | null };

@Component({
  selector: 'app-amenities',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between"><h2>Servicios y equipamiento</h2><button type="button" class="btn btn--sm" (click)="startCreate()">Nuevo servicio</button></div>
    <section class="card table-wrap">
      <table class="table">
        <thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Icono</th><th></th></tr></thead>
        <tbody>
          @for (a of amenities.data() ?? []; track a.id) {
            <tr>
              <td class="mono">{{ a.code }}</td><td>{{ a.name }}</td><td>{{ category[a.category] }}</td><td class="small">{{ a.icon ?? '—' }}</td>
              <td class="right"><button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(a)">Editar</button></td>
            </tr>
          } @empty { <tr><td colspan="5" class="empty">Aún no hay servicios.</td></tr> }
        </tbody>
      </table>
    </section>
    @if (draft(); as d) {
      <form class="card stack" (ngSubmit)="save(d)">
        <h3>{{ d.id ? 'Editar ' + d.name : 'Nuevo servicio' }}</h3>
        <div class="grid-3">
          <div class="field"><label for="am-code">Código *</label><input id="am-code" name="code" [(ngModel)]="d.code" maxlength="50" required placeholder="WIFI"></div>
          <div class="field"><label for="am-name">Nombre *</label><input id="am-name" name="name" [(ngModel)]="d.name" maxlength="100" required></div>
          <div class="field"><label for="am-cat">Categoría</label>
            <select id="am-cat" name="cat" [(ngModel)]="d.category">
              @for (c of categories; track c) { <option [value]="c">{{ category[c] }}</option> }
            </select></div>
          <div class="field"><label for="am-icon">Icono</label><input id="am-icon" name="icon" [(ngModel)]="d.icon" maxlength="50"></div>
        </div>
        <div class="row row--end">
          @if (d.id) { <button type="button" class="btn btn--ghost btn--sm" (click)="remove(d.id)">Eliminar</button> }
          <button type="button" class="btn btn--secondary btn--sm" (click)="draft.set(null)">Cerrar</button>
          <button type="submit" class="btn btn--sm" [disabled]="action.busy()">Guardar</button>
        </div>
      </form>
    }
  `,
})
export class AmenitiesComponent {
  private readonly api = inject(AdminApiService);
  protected readonly action = useAction();
  protected readonly category = AMENITY_CATEGORY;
  protected readonly categories = Object.keys(AMENITY_CATEGORY) as AmenityCategory[];
  protected readonly amenities = apiResource({ stream: () => this.api.amenities() });
  protected readonly draft = signal<Draft | null>(null);

  protected startCreate(): void {
    this.draft.set({ id: null, code: '', name: '', icon: null, category: 'GENERAL' });
  }

  protected startEdit(a: Amenity): void {
    this.draft.set({ id: a.id, code: a.code, name: a.name, icon: a.icon, category: a.category });
  }

  protected async save(d: Draft): Promise<void> {
    const request: AmenityRequest = { code: d.code.trim().toUpperCase(), name: d.name.trim(), icon: d.icon?.trim() || null, category: d.category };
    const saved = await this.action.run(() => (d.id ? this.api.updateAmenity(d.id, request) : this.api.createAmenity(request)), 'Servicio guardado');
    if (saved) {
      this.draft.set(null);
      this.amenities.reload();
    }
  }

  protected async remove(id: string): Promise<void> {
    if (await this.action.runOk(() => this.api.deleteAmenity(id), 'Servicio eliminado')) {
      this.draft.set(null);
      this.amenities.reload();
    }
  }
}
