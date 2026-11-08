import { apiResource } from '../../shared/ui/api-resource';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, viewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { map } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { problemMessage } from '../../core/api/problem';
import { INVOICE_TYPE, VERIFACTU_STATUS } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

@Component({
  selector: 'app-invoice-detail-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (invoice.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else if (invoice.data(); as i) {
      <div class="row row--between head no-print">
        <h1>Factura <span class="mono">{{ i.fullNumber }}</span></h1>
        <div class="row">
          @if (i.reservationId) { <a [routerLink]="['/backoffice/reservas', i.reservationId]" class="btn btn--secondary btn--sm">Reserva {{ i.reservationCode }}</a> }
          <button type="button" class="btn btn--sm" (click)="print()" [disabled]="!document.data()">Imprimir / PDF</button>
        </div>
      </div>
      <div class="cols">
        <section class="card no-print">
          <dl class="kv">
            <dt>Tipo</dt><dd>{{ typeLabel[i.type] }}</dd>
            <dt>Estado</dt><dd>{{ i.status === 'RECTIFIED' ? 'Rectificada' : 'Emitida' }}</dd>
            <dt>Fecha</dt><dd>{{ i.issueDate | date: 'd MMM y' }}</dd>
            @if (i.operationDate) { <dt>Operación</dt><dd>{{ i.operationDate | date: 'd MMM y' }}</dd> }
            <dt>Cliente</dt><dd>{{ i.customer.name }}@if (i.customer.taxId) { · {{ i.customer.taxId }} }</dd>
            @if (i.rectifiedInvoiceNumber) { <dt>Rectifica a</dt><dd class="mono">{{ i.rectifiedInvoiceNumber }}</dd> }
            @if (i.rectificationReason) { <dt>Motivo</dt><dd>{{ i.rectificationReason }}</dd> }
            <dt>Base</dt><dd>{{ i.taxableBase | currency: i.currency }}</dd>
            <dt>IVA</dt><dd>{{ i.vatAmount | currency: i.currency }}</dd>
            <dt>Total</dt><dd><strong>{{ i.totalAmount | currency: i.currency }}</strong></dd>
            <dt>VERI*FACTU</dt><dd>{{ verifactu[i.verifactu.status] }}</dd>
            @if (i.verifactu.hash) { <dt>Huella</dt><dd class="mono hash">{{ i.verifactu.hash }}</dd> }
          </dl>
          @if (i.status === 'ISSUED' && !i.type.startsWith('R')) {
            <form class="stack rectify" (ngSubmit)="rectify(i.id)">
              <h3>Rectificar</h3>
              <p class="small muted">Emite una factura rectificativa. Sin importe, anula la factura completa; con importe, rectifica solo esa cantidad (IVA incluido).</p>
              <div class="field"><label for="rc-r">Motivo *</label><input id="rc-r" name="r" [(ngModel)]="reason" maxlength="500" required></div>
              <div class="field"><label for="rc-a">Importe a rectificar (€)</label><input id="rc-a" type="number" step="0.01" min="0.01" name="a" [(ngModel)]="amount"></div>
              <div class="row row--end"><button type="submit" class="btn btn--danger btn--sm" [disabled]="action.busy() || !reason.trim()">Emitir rectificativa</button></div>
            </form>
          }
        </section>
        <section class="card doc">
          @if (document.data(); as html) {
            <iframe #frame class="doc__frame" title="Factura {{ i.fullNumber }}" [srcdoc]="html" sandbox="allow-modals allow-same-origin"></iframe>
          } @else if (document.error()) {
            <div class="alert alert--danger">No se ha podido cargar el documento.</div>
          } @else {
            <div class="loading"><span class="spinner"></span></div>
          }
        </section>
      </div>
    } @else {
      <div class="loading"><span class="spinner"></span></div>
    }
  `,
  styles: `
    .head h1 { margin: 0; }
    .cols { display: grid; gap: 16px; grid-template-columns: 360px minmax(0, 1fr); align-items: start; }
    .cols .card + .card { margin-top: 0; }
    .hash { word-break: break-all; font-size: 0.72rem; }
    .rectify { margin-top: 16px; border-top: 1px solid var(--c-border); padding-top: 12px; }
    .doc { padding: 0; overflow: hidden; }
    .doc__frame { width: 100%; height: 1100px; border: 0; background: #fff; }
    @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class InvoiceDetailPage {
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly action = useAction();
  protected readonly typeLabel = INVOICE_TYPE;
  protected readonly verifactu = VERIFACTU_STATUS;
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  readonly id = input.required<string>();
  protected readonly invoice = apiResource({ params: () => this.id(), stream: ({ params }) => this.api.invoice(params) });
  /**
   * HTML generado por el backend (los datos van escapados en origen). Se muestra en un iframe con `sandbox`
   * sin `allow-scripts`, de modo que aunque contuviera un script no podría ejecutarse.
   */
  protected readonly document = apiResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.invoiceDocument(params).pipe(map((html) => this.sanitizer.bypassSecurityTrustHtml(html))),
  });
  protected readonly error = computed(() => problemMessage(this.invoice.error()));

  protected reason = '';
  protected amount: number | null = null;

  /** Imprime solo el documento (el navegador permite guardarlo como PDF). */
  protected print(): void {
    this.frame()?.nativeElement.contentWindow?.print();
  }

  protected async rectify(id: string): Promise<void> {
    const amount = this.amount === null || (this.amount as unknown) === '' ? null : Number(this.amount);
    const result = await this.action.run(() => this.api.rectifyInvoice(id, { reason: this.reason.trim(), amount }),
      (r) => `Rectificativa ${r.fullNumber} emitida`);
    if (result) {
      this.reason = '';
      this.amount = null;
      await this.router.navigate(['/backoffice/facturas', result.id]);
    }
  }
}
