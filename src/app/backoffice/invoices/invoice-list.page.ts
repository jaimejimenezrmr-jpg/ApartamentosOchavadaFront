import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { InvoiceResponse } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { startOfMonth, todayInProperty } from '../../core/util/dates';
import { INVOICE_TYPE, VERIFACTU_STATUS } from '../../shared/labels';

@Component({
  selector: 'app-invoice-list-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Facturas</h1>
    <div class="card row filters">
      <div class="field"><label for="iv-f">Desde</label><input id="iv-f" type="date" [ngModel]="from()" (ngModelChange)="$event && from.set($event); page.set(0)"></div>
      <div class="field"><label for="iv-t">Hasta</label><input id="iv-t" type="date" [ngModel]="to()" (ngModelChange)="$event && to.set($event); page.set(0)"></div>
      <span class="grow"></span>
      @if (totals(); as t) {
        <div class="small right">Base {{ t.base | currency }} · IVA {{ t.vat | currency }} · <strong>Total {{ t.total | currency }}</strong>
          <br><span class="muted">(página actual)</span></div>
      }
    </div>
    @if (invoices.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else {
      <div class="card table-wrap">
        <table class="table">
          <thead><tr><th>Número</th><th>Fecha</th><th>Tipo</th><th>Cliente</th><th>Reserva</th><th>VERI*FACTU</th><th class="num">Base</th><th class="num">IVA</th><th class="num">Total</th></tr></thead>
          <tbody>
            @for (i of invoices.data()?.content ?? []; track i.id) {
              <tr class="is-link" [routerLink]="['/backoffice/facturas', i.id]">
                <td class="mono">{{ i.fullNumber }}@if (i.status === 'RECTIFIED') { <span class="badge badge--warning">Rectificada</span> }</td>
                <td>{{ i.issueDate | date: 'd MMM y' }}</td>
                <td>{{ typeLabel[i.type] }}</td>
                <td>{{ i.customer.name }}@if (i.customer.taxId) { <span class="small muted"> · {{ i.customer.taxId }}</span> }</td>
                <td class="mono">{{ i.reservationCode ?? '—' }}</td>
                <td class="small">{{ verifactu[i.verifactu.status] }}</td>
                <td class="num">{{ i.taxableBase | currency: i.currency }}</td>
                <td class="num">{{ i.vatAmount | currency: i.currency }}</td>
                <td class="num">{{ i.totalAmount | currency: i.currency }}</td>
              </tr>
            } @empty { <tr><td colspan="9" class="empty">@if (invoices.isLoading()) { Cargando… } @else { Sin facturas en el periodo. }</td></tr> }
          </tbody>
        </table>
      </div>
      @if (invoices.data(); as p) {
        @if (p.totalPages > 1) {
          <div class="row row--end pager">
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="p.page === 0" (click)="page.set(p.page - 1)">‹</button>
            <span class="small">{{ p.page + 1 }} / {{ p.totalPages }}</span>
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="p.page + 1 >= p.totalPages" (click)="page.set(p.page + 1)">›</button>
          </div>
        }
      }
    }
  `,
  styles: `.filters { align-items: flex-end; margin-bottom: 16px; } .filters .field { width: 170px; } .pager { margin-top: 10px; }`,
})
export class InvoiceListPage {
  private readonly api = inject(BackofficeApiService);
  protected readonly typeLabel = INVOICE_TYPE;
  protected readonly verifactu = VERIFACTU_STATUS;
  private readonly today = todayInProperty();
  protected readonly from = signal(startOfMonth(this.today));
  protected readonly to = signal(this.today);
  protected readonly page = signal(0);
  protected readonly invoices = apiResource({
    params: () => ({ from: this.from(), to: this.to(), page: this.page() }),
    stream: ({ params }) => this.api.invoices(params.from, params.to, params.page),
  });
  protected readonly error = computed(() => problemMessage(this.invoices.error()));
  protected readonly totals = computed(() => {
    const list = this.invoices.data()?.content;
    if (!list?.length) return null;
    const sum = (f: (i: InvoiceResponse) => number) => Math.round(list.reduce((a, i) => a + f(i), 0) * 100) / 100;
    return { base: sum((i) => i.taxableBase), vat: sum((i) => i.vatAmount), total: sum((i) => i.totalAmount) };
  });
}
