import { apiResource } from '../../shared/ui/api-resource';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { SesReportStatus, SesReportSummary } from '../../core/api/models';
import { problemMessage } from '../../core/api/problem';
import { SES_OPERATION, SES_STATUS, SES_TYPE, sesTone } from '../../shared/labels';
import { useAction } from '../../shared/ui/action';

const OPEN: SesReportStatus[] = ['DRAFT', 'PENDING', 'SUBMITTED', 'REJECTED', 'ERROR'];
const ALL = Object.keys(SES_STATUS) as SesReportStatus[];

/** Seguimiento de las comunicaciones al Ministerio del Interior (RD 933/2021). */
@Component({
  selector: 'app-ses-page',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row row--between">
      <h1>SES.HOSPEDAJES</h1>
      <div class="row">
        <button type="button" class="btn btn--sm" [class.btn--secondary]="!onlyOpen()" (click)="onlyOpen.set(true); page.set(0)">Abiertas</button>
        <button type="button" class="btn btn--sm" [class.btn--secondary]="onlyOpen()" (click)="onlyOpen.set(false); page.set(0)">Todas</button>
        <button type="button" class="btn btn--ghost btn--sm" (click)="list.reload()">Actualizar</button>
      </div>
    </div>
    <p class="muted small">Reservas (RH) y partes de viajeros (PV). El parte debe comunicarse en las 24 h siguientes a la entrada.
      Las comunicaciones en borrador esperan datos de los viajeros; las rechazadas o con error pueden reenviarse tras corregirlos.</p>

    <div class="cols">
      <section class="card table-wrap">
        <table class="table">
          <thead><tr><th>Reserva</th><th>Tipo</th><th>Estado</th><th>Plazo</th><th>Código</th></tr></thead>
          <tbody>
            @for (s of list.data()?.content ?? []; track s.id) {
              <tr class="is-link" [class.is-current]="s.id === selectedId()" (click)="select(s)">
                <td class="mono">{{ s.reservationCode }}</td>
                <td>{{ typeLabel[s.type] }} · {{ opLabel[s.operation] }}</td>
                <td><span class="badge badge--{{ tone(s.status) }}">{{ statusLabel[s.status] }}</span>
                  @if (s.overdue) { <span class="badge badge--danger">Fuera de plazo</span> }</td>
                <td class="nowrap small">{{ s.deadlineAt ? (s.deadlineAt | date: 'd MMM HH:mm') : '—' }}</td>
                <td class="mono small">{{ s.communicationCode ?? '' }}</td>
              </tr>
            } @empty { <tr><td colspan="5" class="empty">@if (list.isLoading()) { Cargando… } @else { No hay comunicaciones. }</td></tr> }
          </tbody>
        </table>
        @if (list.data(); as p) {
          @if (p.totalPages > 1) {
            <div class="row row--end pager">
              <button type="button" class="btn btn--secondary btn--sm" [disabled]="p.page === 0" (click)="page.set(p.page - 1)">‹</button>
              <span class="small">{{ p.page + 1 }} / {{ p.totalPages }}</span>
              <button type="button" class="btn btn--secondary btn--sm" [disabled]="p.page + 1 >= p.totalPages" (click)="page.set(p.page + 1)">›</button>
            </div>
          }
        }
      </section>

      <section class="card">
        @if (!selectedId()) {
          <p class="empty">Seleccione una comunicación para ver el detalle.</p>
        } @else if (detail.error()) {
          <div class="alert alert--danger">{{ detailError() }}</div>
        } @else if (detail.data(); as d) {
          <div class="card__title">
            <h3>{{ typeLabel[d.summary.type] }} · {{ opLabel[d.summary.operation] }}</h3>
            <a [routerLink]="['/backoffice/reservas', d.summary.reservationId]" class="small">Reserva {{ d.summary.reservationCode }}</a>
          </div>
          <dl class="kv">
            <dt>Estado</dt><dd><span class="badge badge--{{ tone(d.summary.status) }}">{{ statusLabel[d.summary.status] }}</span></dd>
            @if (d.summary.deadlineAt) { <dt>Plazo</dt><dd>{{ d.summary.deadlineAt | date: 'd MMM y, HH:mm' }}</dd> }
            @if (d.summary.submittedAt) { <dt>Enviada</dt><dd>{{ d.summary.submittedAt | date: 'd MMM y, HH:mm' }}</dd> }
            @if (d.summary.acceptedAt) { <dt>Aceptada</dt><dd>{{ d.summary.acceptedAt | date: 'd MMM y, HH:mm' }}</dd> }
            @if (d.summary.batchId) { <dt>Lote</dt><dd class="mono">{{ d.summary.batchId }}</dd> }
            @if (d.summary.communicationCode) { <dt>Código</dt><dd class="mono">{{ d.summary.communicationCode }}</dd> }
            @if (d.summary.errorMessage) { <dt>Error</dt><dd class="field__error">{{ d.summary.errorCode }} {{ d.summary.errorMessage }}</dd> }
          </dl>
          @if (d.persons.length) {
            <h4>Personas</h4>
            <ul class="small">
              @for (p of d.persons; track $index) {
                <li>{{ p.role === 'TI' ? 'Titular' : 'Viajero' }}: {{ p.fullName }} @if (p.documentNumber) { · {{ p.documentType }} {{ p.documentNumber }} } @if (p.nationality) { · {{ p.nationality }} }</li>
              }
            </ul>
          }
          @if (canResubmit(d.summary)) {
            <div class="row">
              <button type="button" class="btn btn--sm" [disabled]="action.busy()" (click)="resubmit(d.summary.id)">Regenerar y reenviar</button>
              <span class="small muted">Corrija antes los datos en la ficha de los viajeros.</span>
            </div>
          }
          @if (d.requestXml) {
            <details><summary class="small">XML enviado</summary><pre class="xml">{{ d.requestXml }}</pre></details>
          }
          @if (d.responseXml) {
            <details><summary class="small">Respuesta del Ministerio</summary><pre class="xml">{{ d.responseXml }}</pre></details>
          }
        } @else {
          <div class="loading"><span class="spinner"></span></div>
        }
      </section>
    </div>
  `,
  styles: `
    .cols { display: grid; gap: 16px; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); align-items: start; }
    .cols .card + .card { margin-top: 0; }
    tr.is-current { background: var(--c-brand-soft); }
    .pager { margin-top: 10px; }
    .xml { max-height: 320px; overflow: auto; background: var(--c-surface-alt); padding: 10px; font-size: 0.75rem; white-space: pre-wrap; word-break: break-all; }
    @media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class SesPage {
  private readonly api = inject(BackofficeApiService);
  private readonly router = inject(Router);
  protected readonly action = useAction();
  protected readonly typeLabel = SES_TYPE;
  protected readonly opLabel = SES_OPERATION;
  protected readonly statusLabel = SES_STATUS;
  protected readonly tone = sesTone;

  /** `?informe=<id>` abre directamente una comunicación (enlace desde la reserva). */
  readonly informe = input<string>();
  protected readonly onlyOpen = signal(true);
  protected readonly page = signal(0);
  private readonly picked = signal<string | null>(null);
  protected readonly selectedId = computed(() => this.picked() ?? this.informe() ?? null);

  protected readonly list = apiResource({
    params: () => ({ statuses: this.onlyOpen() ? OPEN : ALL, page: this.page() }),
    stream: ({ params }) => this.api.sesReports(params.statuses, params.page),
  });
  protected readonly detail = apiResource({
    params: () => this.selectedId() ?? undefined,
    stream: ({ params }) => this.api.sesReport(params),
  });
  protected readonly detailError = computed(() => problemMessage(this.detail.error()));

  protected select(s: SesReportSummary): void {
    this.picked.set(s.id);
    void this.router.navigate([], { queryParams: { informe: s.id }, replaceUrl: true });
  }

  protected canResubmit(s: SesReportSummary): boolean {
    return s.status === 'DRAFT' || s.status === 'REJECTED' || s.status === 'ERROR' || s.status === 'PENDING';
  }

  protected async resubmit(id: string): Promise<void> {
    const result = await this.action.run(() => this.api.resubmitSesReport(id), 'Comunicación regenerada y en cola');
    if (result) {
      this.detail.set(result);
      this.list.reload();
    }
  }
}
