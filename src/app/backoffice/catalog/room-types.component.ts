import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { Photo, RoomTypeRequest, RoomTypeResponse } from '../../core/api/models';
import { AMENITY_CATEGORY } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

type Draft = Omit<RoomTypeRequest, 'version'> & { id: string | null; version: number | null };

@Component({
  selector: 'app-room-types',
  imports: [CurrencyPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between"><h2>Tipologías</h2><button type="button" class="btn btn--sm" (click)="startCreate()">Nueva tipología</button></div>
    <section class="card table-wrap">
      <table class="table">
        <thead><tr><th>Código</th><th>Nombre</th><th>Capacidad</th><th class="num">Precio desde</th><th>Beds24</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (t of types.data() ?? []; track t.id) {
            <tr [class.is-current]="t.id === draft()?.id">
              <td class="mono">{{ t.code }}</td><td>{{ t.name }}<br><span class="small muted">/apartamentos/{{ t.slug }}</span></td>
              <td>{{ t.maxOccupancy }} pers. · {{ t.bedrooms }} dorm.</td>
              <td class="num">{{ t.basePrice | currency: t.currency }}</td>
              <td>{{ t.beds24RoomId ?? '—' }}</td>
              <td>{{ t.active ? 'Publicada' : 'Oculta' }}</td>
              <td class="right"><button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(t)">Editar</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">Aún no hay tipologías.</td></tr> }
        </tbody>
      </table>
    </section>

    @if (draft(); as d) {
      <form class="card stack" (ngSubmit)="save(d)">
        <h3>{{ d.id ? 'Editar ' + d.name : 'Nueva tipología' }}</h3>
        <div class="grid-3">
          <div class="field"><label for="rt-code">Código *</label><input id="rt-code" name="code" [(ngModel)]="d.code" maxlength="30" required placeholder="DUPLEX-2D"></div>
          <div class="field"><label for="rt-name">Nombre comercial *</label><input id="rt-name" name="name" [(ngModel)]="d.name" maxlength="120" required></div>
          <div class="field"><label for="rt-slug">URL (slug)</label><input id="rt-slug" name="slug" [(ngModel)]="d.slug" maxlength="120" placeholder="Se genera del nombre"></div>
          <div class="field"><label for="rt-occ">Capacidad máx. *</label><input id="rt-occ" type="number" min="1" name="occ" [(ngModel)]="d.maxOccupancy"></div>
          <div class="field"><label for="rt-ad">Adultos máx. *</label><input id="rt-ad" type="number" min="1" name="ad" [(ngModel)]="d.maxAdults"></div>
          <div class="field"><label for="rt-ch">Niños máx. *</label><input id="rt-ch" type="number" min="0" name="ch" [(ngModel)]="d.maxChildren"></div>
          <div class="field"><label for="rt-bd">Dormitorios</label><input id="rt-bd" type="number" min="0" name="bd" [(ngModel)]="d.bedrooms"></div>
          <div class="field"><label for="rt-ba">Baños</label><input id="rt-ba" type="number" min="0" name="ba" [(ngModel)]="d.bathrooms"></div>
          <div class="field"><label for="rt-m2">Superficie (m²)</label><input id="rt-m2" type="number" min="0" step="0.01" name="m2" [(ngModel)]="d.sizeM2"></div>
          <div class="field"><label for="rt-beds">Camas</label><input id="rt-beds" name="beds" [(ngModel)]="d.bedsDescription" maxlength="200" placeholder="1 doble + 2 individuales"></div>
          <div class="field"><label for="rt-price">Precio «desde» (€) *</label><input id="rt-price" type="number" min="0" step="0.01" name="price" [(ngModel)]="d.basePrice"></div>
          <div class="field"><label for="rt-ord">Orden</label><input id="rt-ord" type="number" name="ord" [(ngModel)]="d.displayOrder"></div>
          <div class="field"><label for="rt-b24">ID habitación Beds24</label><input id="rt-b24" type="number" min="1" name="b24" [(ngModel)]="d.beds24RoomId"></div>
          <div class="field"><label for="rt-g">ID habitación Google</label><input id="rt-g" name="g" [(ngModel)]="d.googleRoomId" maxlength="100"></div>
        </div>
        <div class="field"><label for="rt-sd">Descripción breve</label><input id="rt-sd" name="sd" [(ngModel)]="d.shortDescription" maxlength="500"></div>
        <div class="field"><label for="rt-desc">Descripción (párrafos separados por una línea en blanco)</label><textarea id="rt-desc" name="desc" rows="6" [(ngModel)]="d.description"></textarea></div>
        <label class="check"><input type="checkbox" name="act" [(ngModel)]="d.active"> Publicada en la web y a la venta</label>
        <div class="row row--end">
          @if (d.id) { <button type="button" class="btn btn--ghost btn--sm" (click)="remove(d.id)">Eliminar</button> }
          <button type="button" class="btn btn--secondary btn--sm" (click)="draft.set(null)">Cerrar</button>
          <button type="submit" class="btn btn--sm" [disabled]="action.busy()">Guardar</button>
        </div>
      </form>

      @if (current(); as t) {
        <section class="card stack">
          <h3>Fotos</h3>
          <div class="photos">
            @for (p of t.photos; track p.id) {
              <figure class="photo" [class.is-cover]="p.cover">
                <img [src]="p.url" [alt]="p.altText" loading="lazy">
                <figcaption class="small">{{ p.displayOrder }} · {{ p.altText }}</figcaption>
                <div class="row">
                  @if (!p.cover) { <button type="button" class="btn btn--ghost btn--sm" (click)="makeCover(t, p)">Portada</button> }
                  <button type="button" class="btn btn--ghost btn--sm" (click)="removePhoto(t, p)">Quitar</button>
                </div>
              </figure>
            }
          </div>
          <form class="row" (ngSubmit)="addPhoto(t)">
            <input name="url" class="grow" type="url" [(ngModel)]="photoUrl" placeholder="https://… (imagen alojada en su CDN)" required>
            <input name="alt" [(ngModel)]="photoAlt" placeholder="Texto alternativo" maxlength="250" required>
            <input name="ord" type="number" [(ngModel)]="photoOrder" min="0" class="narrow" aria-label="Orden">
            <button type="submit" class="btn btn--sm" [disabled]="action.busy() || !photoUrl.startsWith('https://') || !photoAlt.trim()">Añadir foto</button>
          </form>
        </section>
        <section class="card stack">
          <h3>Equipamiento</h3>
          <div class="amenities">
            @for (a of amenities.data() ?? []; track a.id) {
              <label class="check"><input type="checkbox" [checked]="selectedAmenities().has(a.id)" (change)="toggleAmenity(a.id)">
                {{ a.name }} <span class="muted small">({{ category[a.category] }})</span></label>
            }
          </div>
          <div class="row row--end"><button type="button" class="btn btn--sm" [disabled]="action.busy()" (click)="saveAmenities(t)">Guardar equipamiento</button></div>
        </section>
      }
    }
  `,
  styles: `
    tr.is-current { background: var(--c-brand-soft); }
    .photos { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
    .photo { margin: 0; border: 1px solid var(--c-border); border-radius: var(--radius-sm); padding: 6px; }
    .photo.is-cover { border-color: var(--c-brand); }
    .photo img { aspect-ratio: 4 / 3; object-fit: cover; width: 100%; border-radius: 4px; }
    .narrow { width: 90px; }
    .amenities { display: grid; gap: 6px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  `,
})
export class RoomTypesComponent {
  private readonly api = inject(AdminApiService);
  protected readonly action = useAction();
  protected readonly category = AMENITY_CATEGORY;

  protected readonly types = apiResource({ stream: () => this.api.roomTypes() });
  protected readonly amenities = apiResource({ stream: () => this.api.amenities() });
  protected readonly draft = signal<Draft | null>(null);
  protected readonly current = computed(() => (this.types.data() ?? []).find((t) => t.id === this.draft()?.id) ?? null);
  protected readonly selectedAmenities = signal<Set<string>>(new Set());

  protected photoUrl = '';
  protected photoAlt = '';
  protected photoOrder = 0;

  protected startCreate(): void {
    this.draft.set({
      id: null, version: null, code: '', slug: null, name: '', shortDescription: null, description: null,
      maxOccupancy: 2, maxAdults: 2, maxChildren: 0, bedrooms: 1, bathrooms: 1, bedsDescription: null, sizeM2: null,
      basePrice: 0, displayOrder: 0, active: true, beds24RoomId: null, googleRoomId: null,
    });
  }

  protected startEdit(t: RoomTypeResponse): void {
    this.draft.set({
      id: t.id, version: t.version, code: t.code, slug: t.slug, name: t.name, shortDescription: t.shortDescription,
      description: t.description, maxOccupancy: t.maxOccupancy, maxAdults: t.maxAdults, maxChildren: t.maxChildren,
      bedrooms: t.bedrooms, bathrooms: t.bathrooms, bedsDescription: t.bedsDescription, sizeM2: t.sizeM2,
      basePrice: t.basePrice, displayOrder: t.displayOrder, active: t.active, beds24RoomId: t.beds24RoomId,
      googleRoomId: t.googleRoomId,
    });
    this.selectedAmenities.set(new Set(t.amenities.map((a) => a.id)));
    this.photoOrder = t.photos.length;
  }

  protected async save(d: Draft): Promise<void> {
    const request: RoomTypeRequest = {
      code: d.code.trim().toUpperCase(),
      slug: d.slug?.trim() || null,
      name: d.name.trim(),
      shortDescription: d.shortDescription?.trim() || null,
      description: d.description?.trim() || null,
      maxOccupancy: Number(d.maxOccupancy),
      maxAdults: Number(d.maxAdults),
      maxChildren: Number(d.maxChildren),
      bedrooms: Number(d.bedrooms),
      bathrooms: Number(d.bathrooms),
      bedsDescription: d.bedsDescription?.trim() || null,
      sizeM2: optionalNumber(d.sizeM2),
      basePrice: Number(d.basePrice),
      displayOrder: Number(d.displayOrder) || 0,
      active: d.active,
      beds24RoomId: optionalNumber(d.beds24RoomId),
      googleRoomId: d.googleRoomId?.trim() || null,
      version: d.version,
    };
    const saved = await this.action.run(
      () => (d.id ? this.api.updateRoomType(d.id, request) : this.api.createRoomType(request)), 'Tipología guardada');
    if (saved) {
      this.types.reload();
      this.startEdit(saved);
    }
  }

  protected async remove(id: string): Promise<void> {
    if (await this.action.runOk(() => this.api.deleteRoomType(id), 'Tipología eliminada')) {
      this.draft.set(null);
      this.types.reload();
    }
  }

  protected async addPhoto(t: RoomTypeResponse): Promise<void> {
    const updated = await this.action.run(() => this.api.addPhoto(t.id, {
      url: this.photoUrl.trim(), altText: this.photoAlt.trim(), displayOrder: Number(this.photoOrder) || 0, cover: t.photos.length === 0,
    }), 'Foto añadida');
    if (updated) {
      this.photoUrl = '';
      this.photoAlt = '';
      this.photoOrder = updated.photos.length;
      this.types.reload();
    }
  }

  protected async makeCover(t: RoomTypeResponse, p: Photo): Promise<void> {
    if (await this.action.run(() => this.api.updatePhoto(t.id, p.id, { url: p.url, altText: p.altText, displayOrder: p.displayOrder, cover: true }))) {
      this.types.reload();
    }
  }

  protected async removePhoto(t: RoomTypeResponse, p: Photo): Promise<void> {
    if (await this.action.run(() => this.api.removePhoto(t.id, p.id), 'Foto quitada')) this.types.reload();
  }

  protected toggleAmenity(id: string): void {
    const next = new Set(this.selectedAmenities());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedAmenities.set(next);
  }

  protected async saveAmenities(t: RoomTypeResponse): Promise<void> {
    if (await this.action.run(() => this.api.replaceAmenities(t.id, [...this.selectedAmenities()]), 'Equipamiento guardado')) {
      this.types.reload();
    }
  }
}

function optionalNumber(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}
