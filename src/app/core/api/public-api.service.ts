import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AvailabilityResponse,
  CheckoutRequest,
  CheckoutResponse,
  CheckoutStatusResponse,
  IsoDate,
  PublicRoomTypeDetail,
  PublicRoomTypeSummary,
} from './models';

export const CHECKOUT_TOKEN_HEADER = 'X-Checkout-Token';

/** Catálogo, buscador y checkout de la web pública (sin autenticación). */
@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly http = inject(HttpClient);

  roomTypes(): Observable<PublicRoomTypeSummary[]> {
    return this.http.get<PublicRoomTypeSummary[]>('/api/v1/public/room-types');
  }

  roomType(slug: string): Observable<PublicRoomTypeDetail> {
    return this.http.get<PublicRoomTypeDetail>(`/api/v1/public/room-types/${encodeURIComponent(slug)}`);
  }

  availability(checkIn: IsoDate, checkOut: IsoDate, adults: number, children: number): Observable<AvailabilityResponse> {
    const params = new HttpParams()
      .set('checkIn', checkIn)
      .set('checkOut', checkOut)
      .set('adults', adults)
      .set('children', children);
    return this.http.get<AvailabilityResponse>('/api/v1/public/availability', { params });
  }

  /** Paso 1 del checkout: retiene la unidad y crea el pago. La clave de idempotencia permite reintentar. */
  startCheckout(request: CheckoutRequest, idempotencyKey: string): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>('/api/v1/public/checkout', request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  checkoutStatus(code: string, checkoutToken: string): Observable<CheckoutStatusResponse> {
    return this.http.get<CheckoutStatusResponse>(`/api/v1/public/checkout/${encodeURIComponent(code)}`, {
      headers: new HttpHeaders({ [CHECKOUT_TOKEN_HEADER]: checkoutToken }),
    });
  }

  cancelCheckout(code: string, checkoutToken: string): Observable<void> {
    return this.http.post<void>(`/api/v1/public/checkout/${encodeURIComponent(code)}/cancel`, null, {
      headers: new HttpHeaders({ [CHECKOUT_TOKEN_HEADER]: checkoutToken }),
    });
  }
}
