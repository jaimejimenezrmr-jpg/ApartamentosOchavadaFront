import { isPlatformServer } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      <h1>Página no encontrada</h1>
      <p>La dirección que ha seguido no existe o ha cambiado.</p>
      <a routerLink="/" class="btn">Volver al inicio</a>
    </div>
  `,
  styles: `.page { padding: 48px 16px; }`,
})
export class NotFoundPage {
  constructor() {
    const init = inject(RESPONSE_INIT, { optional: true });
    if (isPlatformServer(inject(PLATFORM_ID)) && init) {
      init.status = 404;
    }
  }
}
