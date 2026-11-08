import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/api/admin-api.service';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { MealPlan, RatePlanRequest, RatePlanResponse } from '../../core/api/models';
import { MEAL_PLAN } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

type Draft = RatePlanRequest & { id: string | null };

@Component({
  selector: 'app-rate-plans',
  imports: [CurrencyPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between"><h2>Planes de tarifa</h2><button type="button" class="btn btn--sm" (click)="startCreate()">Nuevo plan</button></div>
    <section class="card table-wrap">
      <table class="table">
        <thead><tr><th>Tipología</th><th>Plan</th><th>Condiciones</th><th class="num">Precio base</th><th>Mín.</th><th>Canal</th><th></th></tr></thead>
        <tbody>
          @for (p of plans.data() ?? []; track p.id) {
            <tr>
              <td>{{ p.roomTypeName }}</td>
              <td><strong>{{ p.name }}</strong> <span class="mono small muted">{{ p.code }}</span>
                @if (p.defaultPlan) { <span class="badge badge--info">Por defecto</span> } @if (!p.active) { <span class="badge">Inactivo</span> }</td>
              <td class="small">{{ meal[p.mealPlan] }} · {{ p.refundable ? (p.freeCancellationDays !== null ? 'Cancelación gratis hasta ' + p.freeCancellationDays + ' días antes' : 'Reembolsable') : 'No reembolsable' }}
                · prepago {{ p.prepaymentPercent }} %</td>
              <td class="num">{{ p.basePrice | currency }}</td>
              <td>{{ p.minStay }}</td>
              <td class="mono small">{{ p.channelRateCode ?? '—' }}</td>
              <td class="right"><button type="button" class="btn btn--ghost btn--sm" (click)="startEdit(p)">Editar</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="empty">Aún no hay planes.</td></tr> }
        </tbody>
      </table>
    </section>
    @if (draft(); as d) {
      <form class="card stack" (ngSubmit)="save(d)">
        <h3>{{ d.id ? 'Editar plan ' + d.name : 'Nuevo plan' }}</h3>
        <div class="grid-3">
          <div class="field"><label for="rp-type">Tipología *</label>
            <select id="rp-type" name="type" [(ngModel)]="d.roomTypeId" [disabled]="!!d.id" required>
              <option value="">—</option>
              @for (t of types.data() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
            </select></div>
          <div class="field"><label for="rp-code">Código *</label><input id="rp-code" name="code" [(ngModel)]="d.code" maxlength="30" required placeholder="FLEX"></div>
          <div class="field"><label for="rp-name">Nombre *</label><input id="rp-name" name="name" [(ngModel)]="d.name" maxlength="120" required></div>
          <div class="field"><label for="rp-meal">Régimen</label>
            <select id="rp-meal" name="meal" [(ngModel)]="d.mealPlan">
              @for (m of meals; track m) { <option [value]="m">{{ meal[m] }}</option> }
            </select></div>
          <div class="field"><label for="rp-price">Precio base por noche (€) *</label><input id="rp-price" type="number" min="0" step="0.01" name="price" [(ngModel)]="d.basePrice"></div>
          <div class="field"><label for="rp-pre">Prepago (%)</label><input id="rp-pre" type="number" min="0" max="100" step="0.01" name="pre" [(ngModel)]="d.prepaymentPercent"></div>
          <div class="field"><label for="rp-min">Estancia mínima</label><input id="rp-min" type="number" min="1" max="365" name="min" [(ngModel)]="d.minStay"></div>
          <div class="field"><label for="rp-max">Estancia máxima</label><input id="rp-max" type="number" min="1" max="365" name="max" [(ngModel)]="d.maxStay"></div>
          <div class="field"><label for="rp-fc">Cancelación gratuita hasta (días antes)</label>
            <input id="rp-fc" type="number" min="0" max="365" name="fc" [(ngModel)]="d.freeCancellationDays" [disabled]="!d.refundable"></div>
          <div class="field"><label for="rp-ch">Hueco de precio Beds24</label>
            <select id="rp-ch" name="ch" [(ngModel)]="d.channelRateCode">
              <option [ngValue]="null">Sin vincular</option>
              @for (n of slots; track n) { <option [value]="'price' + n">price{{ n }}</option> }
            </select></div>
        </div>
        <div class="field"><label for="rp-desc">Descripción (se muestra en la web)</label><input id="rp-desc" name="desc" [(ngModel)]="d.description" maxlength="1000"></div>
        <div class="row">
          <label class="check"><input type="checkbox" name="ref" [(ngModel)]="d.refundable"> Reembolsable</label>
          <label class="check"><input type="checkbox" name="def" [(ngModel)]="d.defaultPlan"> Plan por defecto de la tipología</label>
          <label class="check"><input type="checkbox" name="act" [(ngModel)]="d.active"> Activo (a la venta)</label>
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
export class RatePlansComponent {
  private readonly api = inject(AdminApiService);
  private readonly backoffice = inject(BackofficeApiService);
  protected readonly action = useAction();
  protected readonly meal = MEAL_PLAN;
  protected readonly meals: MealPlan[] = ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD'];
  protected readonly slots = Array.from({ length: 16 }, (_, i) => i + 1);

  protected readonly plans = apiResource({ stream: () => this.backoffice.ratePlans() });
  protected readonly types = apiResource({ stream: () => this.api.roomTypes() });
  protected readonly draft = signal<Draft | null>(null);

  protected startCreate(): void {
    this.draft.set({
      id: null, version: null, roomTypeId: '', code: '', name: '', description: null, mealPlan: 'ROOM_ONLY', refundable: true,
      freeCancellationDays: 3, prepaymentPercent: 0, basePrice: 0, minStay: 1, maxStay: null, defaultPlan: false, active: true,
      channelRateCode: null,
    });
  }

  protected startEdit(p: RatePlanResponse): void {
    this.draft.set({
      id: p.id, version: p.version, roomTypeId: p.roomTypeId, code: p.code, name: p.name, description: p.description,
      mealPlan: p.mealPlan, refundable: p.refundable, freeCancellationDays: p.freeCancellationDays, prepaymentPercent: p.prepaymentPercent,
      basePrice: p.basePrice, minStay: p.minStay, maxStay: p.maxStay, defaultPlan: p.defaultPlan, active: p.active,
      channelRateCode: p.channelRateCode,
    });
  }

  protected async save(d: Draft): Promise<void> {
    const opt = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
    const request: RatePlanRequest = {
      roomTypeId: d.roomTypeId,
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      description: d.description?.trim() || null,
      mealPlan: d.mealPlan,
      refundable: d.refundable,
      freeCancellationDays: d.refundable ? opt(d.freeCancellationDays) : null,
      prepaymentPercent: Number(d.prepaymentPercent) || 0,
      basePrice: Number(d.basePrice),
      minStay: Number(d.minStay) || 1,
      maxStay: opt(d.maxStay),
      defaultPlan: d.defaultPlan,
      active: d.active,
      channelRateCode: d.channelRateCode || null,
      version: d.version,
    };
    const saved = await this.action.run(
      () => (d.id ? this.api.updateRatePlan(d.id, request) : this.api.createRatePlan(request)), 'Plan guardado');
    if (saved) {
      this.draft.set(null);
      this.plans.reload();
    }
  }

  protected async remove(id: string): Promise<void> {
    if (await this.action.runOk(() => this.api.deleteRatePlan(id), 'Plan eliminado')) {
      this.draft.set(null);
      this.plans.reload();
    }
  }
}
