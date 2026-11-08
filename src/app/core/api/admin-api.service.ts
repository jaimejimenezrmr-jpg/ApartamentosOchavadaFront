import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Amenity,
  AmenityRequest,
  Beds24PollSummary,
  Beds24RemoteRoom,
  Beds24Status,
  DailyRateBulkRequest,
  DailyRateBulkResult,
  ImportResult,
  LockRequest,
  LockResponse,
  PhotoRequest,
  ProviderLock,
  RatePlanRequest,
  RatePlanResponse,
  RateSeasonRequest,
  RateSeasonResponse,
  RoomRequest,
  RoomResponse,
  RoomTypeRequest,
  RoomTypeResponse,
  Uuid,
} from './models';

const A = '/api/v1/admin';

/** Configuración (rol ADMIN): catálogo, tarifas, cerraduras y channel manager. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  // ------------------------------------------------------------------ tipologías

  roomTypes(): Observable<RoomTypeResponse[]> {
    return this.http.get<RoomTypeResponse[]>(`${A}/room-types`);
  }

  roomType(id: Uuid): Observable<RoomTypeResponse> {
    return this.http.get<RoomTypeResponse>(`${A}/room-types/${id}`);
  }

  createRoomType(request: RoomTypeRequest): Observable<RoomTypeResponse> {
    return this.http.post<RoomTypeResponse>(`${A}/room-types`, request);
  }

  updateRoomType(id: Uuid, request: RoomTypeRequest): Observable<RoomTypeResponse> {
    return this.http.put<RoomTypeResponse>(`${A}/room-types/${id}`, request);
  }

  deleteRoomType(id: Uuid): Observable<void> {
    return this.http.delete<void>(`${A}/room-types/${id}`);
  }

  addPhoto(roomTypeId: Uuid, request: PhotoRequest): Observable<RoomTypeResponse> {
    return this.http.post<RoomTypeResponse>(`${A}/room-types/${roomTypeId}/photos`, request);
  }

  updatePhoto(roomTypeId: Uuid, photoId: Uuid, request: PhotoRequest): Observable<RoomTypeResponse> {
    return this.http.put<RoomTypeResponse>(`${A}/room-types/${roomTypeId}/photos/${photoId}`, request);
  }

  removePhoto(roomTypeId: Uuid, photoId: Uuid): Observable<RoomTypeResponse> {
    return this.http.delete<RoomTypeResponse>(`${A}/room-types/${roomTypeId}/photos/${photoId}`);
  }

  replaceAmenities(roomTypeId: Uuid, amenityIds: Uuid[]): Observable<RoomTypeResponse> {
    return this.http.put<RoomTypeResponse>(`${A}/room-types/${roomTypeId}/amenities`, { amenityIds });
  }

  // ------------------------------------------------------------------ servicios

  amenities(): Observable<Amenity[]> {
    return this.http.get<Amenity[]>(`${A}/amenities`);
  }

  createAmenity(request: AmenityRequest): Observable<Amenity> {
    return this.http.post<Amenity>(`${A}/amenities`, request);
  }

  updateAmenity(id: Uuid, request: AmenityRequest): Observable<Amenity> {
    return this.http.put<Amenity>(`${A}/amenities/${id}`, request);
  }

  deleteAmenity(id: Uuid): Observable<void> {
    return this.http.delete<void>(`${A}/amenities/${id}`);
  }

  // ------------------------------------------------------------------ unidades

  createRoom(request: RoomRequest): Observable<RoomResponse> {
    return this.http.post<RoomResponse>(`${A}/rooms`, request);
  }

  updateRoom(id: Uuid, request: RoomRequest): Observable<RoomResponse> {
    return this.http.put<RoomResponse>(`${A}/rooms/${id}`, request);
  }

  deleteRoom(id: Uuid): Observable<void> {
    return this.http.delete<void>(`${A}/rooms/${id}`);
  }

  // ------------------------------------------------------------------ tarifas

  createRatePlan(request: RatePlanRequest): Observable<RatePlanResponse> {
    return this.http.post<RatePlanResponse>(`${A}/rate-plans`, request);
  }

  updateRatePlan(id: Uuid, request: RatePlanRequest): Observable<RatePlanResponse> {
    return this.http.put<RatePlanResponse>(`${A}/rate-plans/${id}`, request);
  }

  deleteRatePlan(id: Uuid): Observable<void> {
    return this.http.delete<void>(`${A}/rate-plans/${id}`);
  }

  createSeason(planId: Uuid, request: RateSeasonRequest): Observable<RateSeasonResponse> {
    return this.http.post<RateSeasonResponse>(`${A}/rate-plans/${planId}/seasons`, request);
  }

  updateSeason(planId: Uuid, seasonId: Uuid, request: RateSeasonRequest): Observable<RateSeasonResponse> {
    return this.http.put<RateSeasonResponse>(`${A}/rate-plans/${planId}/seasons/${seasonId}`, request);
  }

  deleteSeason(planId: Uuid, seasonId: Uuid): Observable<void> {
    return this.http.delete<void>(`${A}/rate-plans/${planId}/seasons/${seasonId}`);
  }

  applyDailyRates(planId: Uuid, request: DailyRateBulkRequest): Observable<DailyRateBulkResult> {
    return this.http.put<DailyRateBulkResult>(`${A}/rate-plans/${planId}/daily-rates`, request);
  }

  // ------------------------------------------------------------------ cerraduras

  providerLocks(): Observable<ProviderLock[]> {
    return this.http.get<ProviderLock[]>(`${A}/locks/provider`);
  }

  createLock(request: LockRequest): Observable<LockResponse> {
    return this.http.post<LockResponse>(`${A}/locks`, request);
  }

  updateLock(id: Uuid, request: LockRequest): Observable<LockResponse> {
    return this.http.put<LockResponse>(`${A}/locks/${id}`, request);
  }

  deleteLock(id: Uuid): Observable<void> {
    return this.http.delete<void>(`${A}/locks/${id}`);
  }

  syncLocks(): Observable<{ updated: number; failed: number }> {
    return this.http.post<{ updated: number; failed: number }>(`${A}/locks/sync`, null);
  }

  // ------------------------------------------------------------------ Beds24

  beds24Status(): Observable<Beds24Status> {
    return this.http.get<Beds24Status>(`${A}/channel/beds24/status`);
  }

  beds24Connect(inviteCode: string): Observable<Beds24Status> {
    return this.http.post<Beds24Status>(`${A}/channel/beds24/connect`, { inviteCode });
  }

  beds24Rooms(): Observable<Beds24RemoteRoom[]> {
    return this.http.get<Beds24RemoteRoom[]>(`${A}/channel/beds24/rooms`);
  }

  beds24Sync(): Observable<{ roomTypesEnqueued: number }> {
    return this.http.post<{ roomTypesEnqueued: number }>(`${A}/channel/beds24/sync`, null);
  }

  beds24Poll(): Observable<Beds24PollSummary> {
    return this.http.post<Beds24PollSummary>(`${A}/channel/beds24/poll`, null);
  }

  beds24ImportUpcoming(): Observable<Beds24PollSummary> {
    return this.http.post<Beds24PollSummary>(`${A}/channel/beds24/import-upcoming`, null);
  }

  beds24ImportBooking(bookingId: number): Observable<{ result: ImportResult }> {
    return this.http.post<{ result: ImportResult }>(`${A}/channel/beds24/bookings/${bookingId}/import`, null);
  }
}
