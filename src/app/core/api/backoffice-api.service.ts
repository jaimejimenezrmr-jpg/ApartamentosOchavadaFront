import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AccessLogEntry,
  DashboardResponse,
  GuestDetail,
  GuestRequest,
  GuestSummary,
  HousekeepingStatus,
  InvoiceResponse,
  IsoDate,
  IssueInvoiceRequest,
  LockResponse,
  ManualReservationRequest,
  PageResponse,
  PropertyPaymentRequest,
  RackResponse,
  RateCalendarResponse,
  RatePlanResponse,
  RateSeasonResponse,
  RectifyInvoiceRequest,
  RefundRequest,
  ReservationDetail,
  ReservationNotesRequest,
  ReservationStatus,
  ReservationSummary,
  RoomBlockRequest,
  RoomBlockResponse,
  RoomResponse,
  SesReportDetail,
  SesReportStatus,
  SesReportSummary,
  StayChangeRequest,
  TaskRequest,
  TaskResponse,
  TaskStatus,
  TravelerData,
  TravelersResponse,
  UnlockResponse,
  Uuid,
} from './models';

const B = '/api/v1/backoffice';

/** Operativa diaria de recepción y limpieza (rol RECEPTIONIST salvo donde se indica). */
@Injectable({ providedIn: 'root' })
export class BackofficeApiService {
  private readonly http = inject(HttpClient);

  // ------------------------------------------------------------------ panel y rack

  dashboard(date?: IsoDate): Observable<DashboardResponse> {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<DashboardResponse>(`${B}/dashboard`, { params });
  }

  rack(from: IsoDate, to: IsoDate): Observable<RackResponse> {
    return this.http.get<RackResponse>(`${B}/rack`, { params: new HttpParams().set('from', from).set('to', to) });
  }

  rooms(roomTypeId?: Uuid): Observable<RoomResponse[]> {
    const params = roomTypeId ? new HttpParams().set('roomTypeId', roomTypeId) : undefined;
    return this.http.get<RoomResponse[]>(`${B}/rooms`, { params });
  }

  blocks(from: IsoDate, to: IsoDate, roomId?: Uuid): Observable<RoomBlockResponse[]> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (roomId) params = params.set('roomId', roomId);
    return this.http.get<RoomBlockResponse[]>(`${B}/room-blocks`, { params });
  }

  createBlock(request: RoomBlockRequest): Observable<RoomBlockResponse> {
    return this.http.post<RoomBlockResponse>(`${B}/room-blocks`, request);
  }

  deleteBlock(id: Uuid): Observable<void> {
    return this.http.delete<void>(`${B}/room-blocks/${id}`);
  }

  // ------------------------------------------------------------------ reservas

  searchReservations(from: IsoDate, to: IsoDate, statuses: ReservationStatus[], q: string, page: number,
                     size = 25): Observable<PageResponse<ReservationSummary>> {
    let params = new HttpParams().set('from', from).set('to', to).set('page', page).set('size', size);
    statuses.forEach((s) => (params = params.append('status', s)));
    if (q.trim()) params = params.set('q', q.trim());
    return this.http.get<PageResponse<ReservationSummary>>(`${B}/reservations`, { params });
  }

  reservation(id: Uuid): Observable<ReservationDetail> {
    return this.http.get<ReservationDetail>(`${B}/reservations/${id}`);
  }

  reservationByCode(code: string): Observable<ReservationDetail> {
    return this.http.get<ReservationDetail>(`${B}/reservations/by-code/${encodeURIComponent(code)}`);
  }

  createReservation(request: ManualReservationRequest): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/reservations`, request);
  }

  updateNotes(id: Uuid, request: ReservationNotesRequest): Observable<ReservationDetail> {
    return this.http.patch<ReservationDetail>(`${B}/reservations/${id}`, request);
  }

  changeStay(id: Uuid, request: StayChangeRequest): Observable<ReservationDetail> {
    return this.http.put<ReservationDetail>(`${B}/reservations/${id}/stay`, request);
  }

  assignRoom(id: Uuid, roomId: Uuid): Observable<ReservationDetail> {
    return this.http.put<ReservationDetail>(`${B}/reservations/${id}/room`, { roomId });
  }

  cancel(id: Uuid, reason: string): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/reservations/${id}/cancel`, { reason });
  }

  noShow(id: Uuid): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/reservations/${id}/no-show`, null);
  }

  checkIn(id: Uuid, force: boolean): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/reservations/${id}/check-in`, { force });
  }

  checkOut(id: Uuid, force: boolean): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/reservations/${id}/check-out`, { force });
  }

  registerPayment(id: Uuid, request: PropertyPaymentRequest): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/reservations/${id}/payments`, request);
  }

  /** Solo ADMIN. */
  refund(paymentId: Uuid, request: RefundRequest): Observable<ReservationDetail> {
    return this.http.post<ReservationDetail>(`${B}/payments/${paymentId}/refund`, request);
  }

  travelers(id: Uuid): Observable<TravelersResponse> {
    return this.http.get<TravelersResponse>(`${B}/reservations/${id}/travelers`);
  }

  saveTravelers(id: Uuid, travelers: TravelerData[]): Observable<TravelersResponse> {
    return this.http.put<TravelersResponse>(`${B}/reservations/${id}/travelers`, { travelers });
  }

  reservationSesReports(id: Uuid): Observable<SesReportSummary[]> {
    return this.http.get<SesReportSummary[]>(`${B}/reservations/${id}/ses-reports`);
  }

  reservationAccessLog(id: Uuid, page = 0): Observable<PageResponse<AccessLogEntry>> {
    return this.http.get<PageResponse<AccessLogEntry>>(`${B}/reservations/${id}/access-log`, {
      params: new HttpParams().set('page', page).set('size', 50),
    });
  }

  // ------------------------------------------------------------------ huéspedes

  searchGuests(q: string, page = 0): Observable<PageResponse<GuestSummary>> {
    return this.http.get<PageResponse<GuestSummary>>(`${B}/guests`, {
      params: new HttpParams().set('q', q).set('page', page).set('size', 20),
    });
  }

  guest(id: Uuid): Observable<GuestDetail> {
    return this.http.get<GuestDetail>(`${B}/guests/${id}`);
  }

  updateGuest(id: Uuid, request: GuestRequest): Observable<GuestDetail> {
    return this.http.put<GuestDetail>(`${B}/guests/${id}`, request);
  }

  // ------------------------------------------------------------------ tarifas (lectura)

  ratePlans(roomTypeId?: Uuid): Observable<RatePlanResponse[]> {
    const params = roomTypeId ? new HttpParams().set('roomTypeId', roomTypeId) : undefined;
    return this.http.get<RatePlanResponse[]>(`${B}/rate-plans`, { params });
  }

  seasons(planId: Uuid): Observable<RateSeasonResponse[]> {
    return this.http.get<RateSeasonResponse[]>(`${B}/rate-plans/${planId}/seasons`);
  }

  /** Días de `from` a `to`, ambos incluidos. */
  rateCalendar(planId: Uuid, from: IsoDate, to: IsoDate): Observable<RateCalendarResponse> {
    return this.http.get<RateCalendarResponse>(`${B}/rate-plans/${planId}/calendar`, {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }

  // ------------------------------------------------------------------ limpieza

  tasks(date: IsoDate | null, status: TaskStatus | null): Observable<TaskResponse[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    if (status) params = params.set('status', status);
    return this.http.get<TaskResponse[]>(`${B}/housekeeping/tasks`, { params });
  }

  createTask(request: TaskRequest): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(`${B}/housekeeping/tasks`, request);
  }

  startTask(id: Uuid): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(`${B}/housekeeping/tasks/${id}/start`, null);
  }

  completeTask(id: Uuid, notes: string | null): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(`${B}/housekeeping/tasks/${id}/complete`, notes ? { notes } : null);
  }

  verifyTask(id: Uuid): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(`${B}/housekeeping/tasks/${id}/verify`, null);
  }

  cancelTask(id: Uuid): Observable<TaskResponse> {
    return this.http.post<TaskResponse>(`${B}/housekeeping/tasks/${id}/cancel`, null);
  }

  changeRoomHousekeeping(roomId: Uuid, status: HousekeepingStatus): Observable<RoomResponse> {
    return this.http.put<RoomResponse>(`${B}/housekeeping/rooms/${roomId}/status`, { status });
  }

  // ------------------------------------------------------------------ facturación

  issueInvoice(reservationId: Uuid, request: IssueInvoiceRequest): Observable<InvoiceResponse> {
    return this.http.post<InvoiceResponse>(`${B}/reservations/${reservationId}/invoices`, request);
  }

  invoices(from: IsoDate, to: IsoDate, page: number): Observable<PageResponse<InvoiceResponse>> {
    return this.http.get<PageResponse<InvoiceResponse>>(`${B}/invoices`, {
      params: new HttpParams().set('from', from).set('to', to).set('page', page).set('size', 50),
    });
  }

  invoice(id: Uuid): Observable<InvoiceResponse> {
    return this.http.get<InvoiceResponse>(`${B}/invoices/${id}`);
  }

  /** Factura en HTML imprimible. */
  invoiceDocument(id: Uuid): Observable<string> {
    return this.http.get(`${B}/invoices/${id}/document`, { responseType: 'text' });
  }

  rectifyInvoice(id: Uuid, request: RectifyInvoiceRequest): Observable<InvoiceResponse> {
    return this.http.post<InvoiceResponse>(`${B}/invoices/${id}/rectify`, request);
  }

  // ------------------------------------------------------------------ SES.HOSPEDAJES

  sesReports(statuses: SesReportStatus[], page: number): Observable<PageResponse<SesReportSummary>> {
    let params = new HttpParams().set('page', page).set('size', 50);
    statuses.forEach((s) => (params = params.append('status', s)));
    return this.http.get<PageResponse<SesReportSummary>>(`${B}/ses/reports`, { params });
  }

  sesReport(id: Uuid): Observable<SesReportDetail> {
    return this.http.get<SesReportDetail>(`${B}/ses/reports/${id}`);
  }

  resubmitSesReport(id: Uuid): Observable<SesReportDetail> {
    return this.http.post<SesReportDetail>(`${B}/ses/reports/${id}/submit`, null);
  }

  // ------------------------------------------------------------------ cerraduras

  locks(): Observable<LockResponse[]> {
    return this.http.get<LockResponse[]>(`${B}/locks`);
  }

  unlockLock(id: Uuid): Observable<UnlockResponse> {
    return this.http.post<UnlockResponse>(`${B}/locks/${id}/unlock`, null);
  }

  lockAccessLog(id: Uuid, from: string, to: string, page = 0): Observable<PageResponse<AccessLogEntry>> {
    return this.http.get<PageResponse<AccessLogEntry>>(`${B}/locks/${id}/access-log`, {
      params: new HttpParams().set('from', from).set('to', to).set('page', page).set('size', 50),
    });
  }
}
