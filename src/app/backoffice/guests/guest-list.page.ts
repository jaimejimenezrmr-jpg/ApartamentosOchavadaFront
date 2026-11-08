import { apiResource } from '../../shared/ui/api-resource';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BackofficeApiService } from '../../core/api/backoffice-api.service';
import { problemMessage } from '../../core/api/problem';
import { countryName } from '../../shared/countries';

@Component({
  selector: 'app-guest-list-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Huéspedes</h1>
    <form class="card row" (ngSubmit)="search()">
      <input type="search" name="q" class="grow" [(ngModel)]="query" placeholder="Nombre, email, teléfono o documento (mín. 2 caracteres)" aria-label="Buscar huésped">
      <button type="submit" class="btn" [disabled]="query.trim().length < 2">Buscar</button>
    </form>
    @if (result.error()) {
      <div class="alert alert--danger">{{ error() }}</div>
    } @else if (term()) {
      <div class="card table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Nacionalidad</th><th>Documento</th></tr></thead>
          <tbody>
            @for (g of result.data()?.content ?? []; track g.id) {
              <tr class="is-link" [routerLink]="['/backoffice/huespedes', g.id]">
                <td><strong>{{ g.fullName }}</strong></td><td>{{ g.email ?? '—' }}</td><td>{{ g.phone ?? '—' }}</td>
                <td>{{ country(g.nationality) || '—' }}</td><td class="mono">{{ g.documentNumber ?? '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">@if (result.isLoading()) { Buscando… } @else { Sin resultados. }</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (result.data(); as page) {
        @if (page.totalPages > 1) {
          <div class="row row--end pager">
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="page.page === 0" (click)="page$.set(page.page - 1)">‹</button>
            <span class="small">{{ page.page + 1 }} / {{ page.totalPages }}</span>
            <button type="button" class="btn btn--secondary btn--sm" [disabled]="page.page + 1 >= page.totalPages" (click)="page$.set(page.page + 1)">›</button>
          </div>
        }
      }
    }
  `,
  styles: `.card.row { margin-bottom: 16px; } .pager { margin-top: 10px; }`,
})
export class GuestListPage {
  private readonly api = inject(BackofficeApiService);
  protected readonly country = countryName;
  protected query = '';
  protected readonly term = signal('');
  protected readonly page$ = signal(0);
  protected readonly result = apiResource({
    params: () => (this.term() ? { q: this.term(), page: this.page$() } : undefined),
    stream: ({ params }) => this.api.searchGuests(params.q, params.page),
  });
  protected readonly error = computed(() => problemMessage(this.result.error()));

  protected search(): void {
    if (this.query.trim().length < 2) return;
    this.page$.set(0);
    this.term.set(this.query.trim());
  }
}
