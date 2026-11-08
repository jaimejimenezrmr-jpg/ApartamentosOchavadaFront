import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h1>Sin permiso</h1>
      <p>Su perfil no tiene acceso a esta sección. Si lo necesita, pídalo a la administración.</p>
      <a routerLink="/backoffice" class="btn btn--secondary">Volver</a>
    </section>
  `,
})
export class ForbiddenPage {}
