import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteConfigService } from '../../core/config/site-config.service';

type LegalKind = 'terms' | 'privacy' | 'notice';

/**
 * Textos legales generados a partir de los datos del establecimiento (`PROPERTY_*`). El titular debe
 * revisarlos con su asesor antes de publicar: dependen de su forma jurídica y de sus encargados de tratamiento.
 */
@Component({
  selector: 'app-legal-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="container legal">
      @switch (kind()) {
        @case ('terms') {
          <h1>Condiciones de reserva</h1>
          <h2>1. Prestador del servicio</h2>
          <p>El alojamiento lo presta {{ owner() }}, con domicilio en {{ c().address }}.
            @if (c().tourismRegistry) { Inscrito en el Registro de Turismo de Andalucía con el número {{ c().tourismRegistry }}. }</p>
          <h2>2. Precio y forma de pago</h2>
          <p>Los precios se muestran por estancia completa en euros e incluyen el IVA aplicable. Antes de confirmar se indica el
            importe total, la parte que se abona al reservar (prepago) y, en su caso, la que se paga en el alojamiento.
            Los pagos online se procesan con Stripe; los datos de la tarjeta nunca llegan a nuestros servidores.</p>
          <h2>3. Formalización</h2>
          <p>La reserva queda confirmada cuando se completa el pago del prepago (o al finalizar el proceso si la tarifa no lo
            exige). Recibirá un email con el localizador, el resumen de la estancia y el enlace a «Mi estancia».</p>
          <h2>4. Cancelación y modificación</h2>
          <p>Cada tarifa indica sus condiciones: las tarifas flexibles permiten cancelar sin coste hasta la fecha indicada en la
            oferta; las tarifas no reembolsables no admiten devolución del importe abonado. Para cancelar o modificar una
            reserva, contacte con nosotros indicando el localizador.</p>
          <h2>5. Llegada, salida y registro de viajeros</h2>
          <p>La entrada es a partir de las {{ c().checkInTime }} y la salida, antes de las {{ c().checkOutTime }}. La normativa
            (Real Decreto 933/2021) obliga a registrar a todos los viajeros mayores de 14 años con su documento de identidad;
            puede hacerlo online desde «Mi estancia» antes de llegar. Sin ese registro no es posible entregar el acceso.</p>
          <h2>6. Uso del alojamiento</h2>
          <p>El número de ocupantes no puede superar la capacidad contratada. Se ruega respetar el descanso de los vecinos.</p>
          <h2>7. Legislación aplicable</h2>
          <p>Estas condiciones se rigen por la legislación española, en particular la normativa turística de Andalucía y la de
            defensa de los consumidores y usuarios. Dispone de hojas de quejas y reclamaciones oficiales a su disposición.</p>
        }
        @case ('privacy') {
          <h1>Política de privacidad</h1>
          <h2>Responsable</h2>
          <p>{{ owner() }}@if (c().address) {, {{ c().address }}}.
            @if (c().email) { Contacto: <a [href]="'mailto:' + c().email">{{ c().email }}</a>. }</p>
          <h2>Finalidades y bases jurídicas</h2>
          <ul>
            <li><strong>Gestionar su reserva y su estancia</strong> (ejecución del contrato): datos de contacto, fechas y pagos.</li>
            <li><strong>Registro de viajeros</strong> ante el Ministerio del Interior (obligación legal, RD 933/2021): datos de
              identidad de los viajeros, que se conservan durante el plazo que fija esa norma.</li>
            <li><strong>Facturación y contabilidad</strong> (obligación legal): se conservan durante los plazos de la normativa tributaria.</li>
            <li><strong>Comunicaciones comerciales</strong>, solo si las ha aceptado expresamente (consentimiento revocable en cualquier momento).</li>
          </ul>
          <h2>Destinatarios</h2>
          <p>Ministerio del Interior (SES.HOSPEDAJES), Agencia Tributaria cuando proceda, y los proveedores que nos prestan
            servicios bajo contrato de encargo: pasarela de pago (Stripe), gestor de canales (Beds24), cerraduras electrónicas
            (TTLock) y alojamiento de la web. Si reservó a través de una agencia online, esta también trata sus datos.</p>
          <h2>Derechos</h2>
          <p>Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo al
            contacto indicado. Si considera que no se han atendido, puede reclamar ante la Agencia Española de Protección de Datos
            (<a href="https://www.aepd.es" rel="noopener" target="_blank">www.aepd.es</a>).</p>
          <h2>Cookies</h2>
          <p>Esta web no utiliza cookies publicitarias ni de análisis. Solo emplea almacenamiento técnico imprescindible para el
            proceso de reserva, el acceso del personal y la sesión de «Mi estancia», y el que necesita Stripe para prevenir el fraude en los pagos.</p>
        }
        @default {
          <h1>Aviso legal</h1>
          <p>En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico:</p>
          <dl class="kv">
            <dt>Titular</dt><dd>{{ c().legalName }}</dd>
            @if (c().legalTaxId) { <dt>NIF</dt><dd>{{ c().legalTaxId }}</dd> }
            <dt>Domicilio</dt><dd>{{ c().address }}</dd>
            @if (c().email) { <dt>Email</dt><dd><a [href]="'mailto:' + c().email">{{ c().email }}</a></dd> }
            @if (c().phone) { <dt>Teléfono</dt><dd>{{ c().phone }}</dd> }
            @if (c().tourismRegistry) { <dt>Registro de Turismo</dt><dd>{{ c().tourismRegistry }}</dd> }
          </dl>
          <h2>Propiedad intelectual</h2>
          <p>Los contenidos de esta web (textos, fotografías y diseño) pertenecen a su titular o se usan con licencia. No se
            permite su reproducción sin autorización.</p>
          <h2>Responsabilidad</h2>
          <p>Los precios y la disponibilidad se actualizan en tiempo real; en caso de error manifiesto se informará al cliente
            antes de formalizar la reserva. Consulte también las <a routerLink="/condiciones">condiciones de reserva</a> y la
            <a routerLink="/privacidad">política de privacidad</a>.</p>
        }
      }
    </article>
  `,
  styles: `
    .legal { max-width: 820px; padding-top: 32px; }
    .legal h2 { font-size: 1.15rem; margin-top: 1.6em; }
    .legal ul { padding-left: 20px; }
  `,
})
export class LegalPage {
  readonly kind = input<LegalKind>('notice');
  protected readonly c = inject(SiteConfigService).config;
  protected readonly owner = computed(() =>
    this.c().legalTaxId ? `${this.c().legalName} (NIF ${this.c().legalTaxId})` : this.c().legalName,
  );
}
