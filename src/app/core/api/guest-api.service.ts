import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DoorKind, DoorsResponse, GuestStayResponse, GuestTokenResponse, TravelerData, TravelersResponse, UnlockResponse } from './models';

/** Portal del huésped «Mi estancia» (JWT de huésped). */
@Injectable({ providedIn: 'root' })
export class GuestApiService {
  private readonly http = inject(HttpClient);

  exchange(token: string): Observable<GuestTokenResponse> {
    return this.http.post<GuestTokenResponse>('/api/v1/guest/auth/exchange', { token });
  }

  stay(): Observable<GuestStayResponse> {
    return this.http.get<GuestStayResponse>('/api/v1/guest/stay');
  }

  travelers(): Observable<TravelersResponse> {
    return this.http.get<TravelersResponse>('/api/v1/guest/travelers');
  }

  saveTravelers(travelers: TravelerData[]): Observable<TravelersResponse> {
    return this.http.put<TravelersResponse>('/api/v1/guest/travelers', { travelers });
  }

  doors(): Observable<DoorsResponse> {
    return this.http.get<DoorsResponse>('/api/v1/guest/doors');
  }

  selfCheckIn(): Observable<DoorsResponse> {
    return this.http.post<DoorsResponse>('/api/v1/guest/check-in', null);
  }

  unlock(kind: DoorKind): Observable<UnlockResponse> {
    const door = kind === 'MAIN_ENTRANCE' ? 'main-entrance' : 'room';
    return this.http.post<UnlockResponse>(`/api/v1/guest/doors/${door}/unlock`, null);
  }
}
