/**
 * Contrato de la API REST del backend (Spring Boot). Fechas `LocalDate` como `YYYY-MM-DD`, instantes como
 * ISO-8601 UTC, horas `LocalTime` como `HH:mm[:ss]` e importes `BigDecimal` como números JSON.
 */

export type Uuid = string;
export type IsoDate = string;
export type IsoInstant = string;
export type IsoTime = string;

// ------------------------------------------------------------------ enumerados

export type ReservationStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
export type ReservationChannel =
  | 'DIRECT' | 'BOOKING_COM' | 'AIRBNB' | 'EXPEDIA' | 'GOOGLE' | 'BEDS24_OTHER' | 'PHONE' | 'WALK_IN';
export type PaymentMode = 'ONLINE' | 'AT_PROPERTY' | 'OTA_COLLECT';
export type PaymentProvider = 'STRIPE' | 'CASH' | 'CARD_TERMINAL' | 'BANK_TRANSFER' | 'OTA';
export type PaymentStatus =
  | 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type MealPlan = 'ROOM_ONLY' | 'BREAKFAST' | 'HALF_BOARD' | 'FULL_BOARD';
export type RestrictionCode = 'STOP_SELL' | 'CLOSED_TO_ARRIVAL' | 'CLOSED_TO_DEPARTURE' | 'MIN_STAY' | 'MAX_STAY';
export type PriceSource = 'DAILY_OVERRIDE' | 'SEASON_WEEKEND' | 'SEASON' | 'BASE';
export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'HOUSEKEEPING';
export type RoomStatus = 'ACTIVE' | 'OUT_OF_ORDER' | 'INACTIVE';
export type HousekeepingStatus = 'CLEAN' | 'DIRTY' | 'IN_PROGRESS' | 'INSPECTED' | 'OUT_OF_SERVICE';
export type BlockType = 'MAINTENANCE' | 'OWNER_USE' | 'OUT_OF_ORDER' | 'OTHER';
export type AmenityCategory =
  | 'GENERAL' | 'KITCHEN' | 'BATHROOM' | 'BEDROOM' | 'ENTERTAINMENT' | 'ACCESSIBILITY' | 'OUTDOOR' | 'SERVICES';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'VERIFIED' | 'CANCELLED';
export type TaskType = 'CHECKOUT_CLEAN' | 'STAYOVER_CLEAN' | 'DEEP_CLEAN' | 'INSPECTION' | 'MAINTENANCE' | 'LINEN_CHANGE';
export type DocumentType = 'NIF' | 'NIE' | 'PAS' | 'OTRO';
export type InvoiceType = 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type InvoiceStatus = 'ISSUED' | 'RECTIFIED';
export type VerifactuStatus = 'NOT_APPLICABLE' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'ACCEPTED_WITH_ERRORS' | 'REJECTED';
export type DoorKind = 'MAIN_ENTRANCE' | 'ROOM';
export type LockType = 'MAIN_ENTRANCE' | 'ROOM' | 'COMMON_AREA';
export type SesCommunicationType = 'RESERVATION' | 'TRAVELER_ENTRY';
export type SesOperation = 'A' | 'M' | 'B';
export type SesReportStatus = 'DRAFT' | 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'ERROR' | 'CANCELLED';
export type ImportResult = 'CREATED' | 'UPDATED' | 'CANCELLED' | 'UNCHANGED' | 'NEEDS_REVIEW' | 'OWN_ECHO' | 'IGNORED';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// ------------------------------------------------------------------ catálogo público y disponibilidad

export interface Photo {
  id: Uuid;
  url: string;
  altText: string;
  displayOrder: number;
  cover: boolean;
}

export interface Amenity {
  id: Uuid;
  code: string;
  name: string;
  icon: string | null;
  category: AmenityCategory;
}

export interface PublicRoomTypeSummary {
  slug: string;
  name: string;
  shortDescription: string | null;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  bedrooms: number;
  bathrooms: number;
  bedsDescription: string | null;
  sizeM2: number | null;
  fromPrice: number;
  currency: string;
  coverPhoto: Photo | null;
}

export interface PublicRoomTypeDetail extends Omit<PublicRoomTypeSummary, 'coverPhoto'> {
  description: string | null;
  photos: Photo[];
  amenities: Amenity[];
}

export interface RestrictionViolation {
  code: RestrictionCode;
  message: string;
  value: number | null;
  date: IsoDate | null;
}

export interface NightPrice {
  date: IsoDate;
  price: number;
}

export interface RateOffer {
  ratePlanId: Uuid;
  code: string;
  name: string;
  description: string | null;
  mealPlan: MealPlan;
  refundable: boolean;
  freeCancellationUntil: IsoDate | null;
  prepaymentPercent: number;
  prepaymentAmount: number;
  totalAmount: number;
  averageNightlyPrice: number;
  nights: NightPrice[];
  bookable: boolean;
  restrictions: RestrictionViolation[];
}

export interface RoomTypeAvailability {
  roomType: PublicRoomTypeSummary;
  availableUnits: number;
  offers: RateOffer[];
}

export interface AvailabilityResponse {
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  adults: number;
  children: number;
  currency: string;
  results: RoomTypeAvailability[];
}

// ------------------------------------------------------------------ checkout

export interface CheckoutGuest {
  firstName: string;
  lastName1: string;
  lastName2: string | null;
  email: string;
  phone: string;
  countryCode: string;
}

export interface CheckoutRequest {
  ratePlanId: Uuid;
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  guest: CheckoutGuest;
  specialRequests: string | null;
  expectedArrivalTime: IsoTime | null;
  locale: 'es' | 'en';
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  marketingConsent: boolean;
}

export interface CheckoutResponse {
  reservationCode: string;
  status: ReservationStatus;
  checkoutToken: string;
  holdExpiresAt: IsoInstant | null;
  currency: string;
  totalAmount: number;
  prepaymentAmount: number;
  amountDueAtProperty: number;
  freeCancellationUntil: IsoDate | null;
  stay: {
    roomTypeName: string;
    roomTypeSlug: string;
    ratePlanName: string;
    checkIn: IsoDate;
    checkOut: IsoDate;
    nights: number;
    adults: number;
    children: number;
  };
  payment: { provider: string; publishableKey: string; clientSecret: string } | null;
}

export interface CheckoutStatusResponse {
  reservationCode: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureMessage: string | null;
  holdExpiresAt: IsoInstant | null;
  totalAmount: number;
  paidAmount: number;
  currency: string;
}

// ------------------------------------------------------------------ portal del huésped

export interface GuestTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: IsoInstant;
  reservationCode: string;
}

export interface GuestStayResponse {
  reservationCode: string;
  status: ReservationStatus;
  holderName: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkIn: IsoDate;
  checkOut: IsoDate;
  checkInTime: IsoTime;
  checkOutTime: IsoTime;
  nights: number;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currency: string;
  paymentMode: PaymentMode;
  onlineCheckinCompleted: boolean;
  property: { name: string; address: string | null; phone: string | null; email: string | null };
}

export interface TravelerData {
  firstName: string | null;
  lastName1: string | null;
  lastName2: string | null;
  sex: 'H' | 'M' | 'O' | null;
  birthDate: IsoDate | null;
  nationality: string | null;
  documentType: DocumentType | null;
  documentNumber: string | null;
  documentSupportNumber: string | null;
  documentIssueDate: IsoDate | null;
  email: string | null;
  phone: string | null;
  phoneLandline: string | null;
  addressLine: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  city: string | null;
  municipalityCode: string | null;
  province: string | null;
  countryCode: string | null;
  relationship: string | null;
}

export interface TravelerIssue {
  index: number;
  field: string;
  message: string;
}

export interface TravelersResponse {
  reservationCode: string;
  requiredTravelers: number;
  complete: boolean;
  onlineCheckinCompletedAt: IsoInstant | null;
  travelers: TravelerData[];
  issues: TravelerIssue[];
}

export interface Door {
  kind: DoorKind;
  name: string;
  available: boolean;
  reason: string | null;
}

export interface DoorsResponse {
  reservationCode: string;
  status: ReservationStatus;
  accessFrom: IsoInstant | null;
  accessUntil: IsoInstant | null;
  selfCheckIn: { available: boolean; blockers: string[] };
  doors: Door[];
}

export interface UnlockResponse {
  kind: DoorKind;
  doorName: string;
  result: string;
  openedAt: IsoInstant;
}

// ------------------------------------------------------------------ autenticación del personal

export interface CurrentUser {
  id: Uuid;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  lastLoginAt: IsoInstant | null;
  /** Contraseña temporal: hay que cambiarla antes de usar el backoffice. */
  passwordChangeRequired: boolean;
  passwordChangedAt: IsoInstant | null;
}

// ------------------------------------------------------------------ usuarios del backoffice

export interface StaffUser {
  id: Uuid;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  enabled: boolean;
  locked: boolean;
  lockedUntil: IsoInstant | null;
  passwordChangeRequired: boolean;
  lastLoginAt: IsoInstant | null;
  passwordChangedAt: IsoInstant | null;
  createdAt: IsoInstant;
  version: number;
}

export interface CreateStaffUserRequest {
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
}

export interface UpdateStaffUserRequest {
  fullName: string;
  phone: string | null;
  role: UserRole;
  enabled: boolean;
  version: number;
}

/** La contraseña temporal solo llega en esta respuesta. */
export interface StaffUserWithTemporaryPassword {
  user: StaffUser;
  temporaryPassword: string;
}

export interface StaffTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: IsoInstant;
  user: CurrentUser;
}

// ------------------------------------------------------------------ catálogo (backoffice)

export interface RoomTypeResponse {
  id: Uuid;
  code: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  bedrooms: number;
  bathrooms: number;
  bedsDescription: string | null;
  sizeM2: number | null;
  basePrice: number;
  currency: string;
  displayOrder: number;
  active: boolean;
  beds24RoomId: number | null;
  googleRoomId: string | null;
  photos: Photo[];
  amenities: Amenity[];
  version: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
}

export interface RoomTypeRequest {
  code: string;
  slug: string | null;
  name: string;
  shortDescription: string | null;
  description: string | null;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  bedrooms: number;
  bathrooms: number;
  bedsDescription: string | null;
  sizeM2: number | null;
  basePrice: number;
  displayOrder: number;
  active: boolean;
  beds24RoomId: number | null;
  googleRoomId: string | null;
  version: number | null;
}

export interface PhotoRequest {
  url: string;
  altText: string;
  displayOrder: number;
  cover: boolean;
}

export interface AmenityRequest {
  code: string;
  name: string;
  icon: string | null;
  category: AmenityCategory;
}

export interface RoomResponse {
  id: Uuid;
  roomTypeId: Uuid;
  roomTypeName: string;
  number: string;
  name: string | null;
  floor: number | null;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  housekeepingUpdatedAt: IsoInstant | null;
  beds24UnitId: number | null;
  notes: string | null;
  version: number;
}

export interface RoomRequest {
  roomTypeId: Uuid;
  number: string;
  name: string | null;
  floor: number | null;
  status: RoomStatus;
  beds24UnitId: number | null;
  notes: string | null;
  version: number | null;
}

export interface RoomBlockResponse {
  id: Uuid;
  roomId: Uuid;
  roomNumber: string;
  startDate: IsoDate;
  endDate: IsoDate;
  blockType: BlockType;
  reason: string | null;
  createdByUserId: Uuid | null;
  createdAt: IsoInstant;
}

export interface RoomBlockRequest {
  roomId: Uuid;
  startDate: IsoDate;
  endDate: IsoDate;
  blockType: BlockType;
  reason: string | null;
}

// ------------------------------------------------------------------ tarifas

export interface RatePlanResponse {
  id: Uuid;
  roomTypeId: Uuid;
  roomTypeName: string;
  code: string;
  name: string;
  description: string | null;
  mealPlan: MealPlan;
  refundable: boolean;
  freeCancellationDays: number | null;
  prepaymentPercent: number;
  basePrice: number;
  minStay: number;
  maxStay: number | null;
  defaultPlan: boolean;
  active: boolean;
  channelRateCode: string | null;
  version: number;
}

export interface RatePlanRequest {
  roomTypeId: Uuid;
  code: string;
  name: string;
  description: string | null;
  mealPlan: MealPlan;
  refundable: boolean;
  freeCancellationDays: number | null;
  prepaymentPercent: number;
  basePrice: number;
  minStay: number;
  maxStay: number | null;
  defaultPlan: boolean;
  active: boolean;
  channelRateCode: string | null;
  version: number | null;
}

export interface RateSeasonResponse {
  id: Uuid;
  ratePlanId: Uuid;
  name: string;
  firstNight: IsoDate;
  lastNight: IsoDate;
  nightlyPrice: number;
  weekendPrice: number | null;
  minStay: number | null;
  maxStay: number | null;
  version: number;
}

export interface RateSeasonRequest {
  name: string;
  firstNight: IsoDate;
  lastNight: IsoDate;
  nightlyPrice: number;
  weekendPrice: number | null;
  minStay: number | null;
  maxStay: number | null;
  version: number | null;
}

export type ClearableField = 'PRICE' | 'MIN_STAY' | 'MAX_STAY';

export interface DailyRateBulkRequest {
  firstNight: IsoDate;
  lastNight: IsoDate;
  daysOfWeek: DayOfWeek[] | null;
  price: number | null;
  minStay: number | null;
  maxStay: number | null;
  closedToArrival: boolean | null;
  closedToDeparture: boolean | null;
  stopSell: boolean | null;
  clear: ClearableField[] | null;
}

export interface DailyRateBulkResult {
  affectedDays: number;
  removedOverrides: number;
}

export interface RateCalendarDay {
  date: IsoDate;
  price: number;
  priceSource: PriceSource;
  minStay: number;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSell: boolean;
  availableUnits: number;
}

export interface RateCalendarResponse {
  ratePlanId: Uuid;
  roomTypeId: Uuid;
  currency: string;
  days: RateCalendarDay[];
}

// ------------------------------------------------------------------ reservas (backoffice)

export interface GuestSummary {
  id: Uuid;
  fullName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  documentNumber: string | null;
}

export interface ReservationSummary {
  id: Uuid;
  code: string;
  status: ReservationStatus;
  channel: ReservationChannel;
  holderName: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  adults: number;
  children: number;
  totalAmount: number;
  balanceDue: number;
  currency: string;
}

export interface Ref {
  id: Uuid;
  name: string;
}

export interface PaymentLine {
  id: Uuid;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  paidAt: IsoInstant | null;
  reference: string | null;
  cardLast4: string | null;
  failureMessage: string | null;
}

export interface InvoiceRef {
  id: Uuid;
  fullNumber: string;
  invoiceType: string;
  status: string;
  issueDate: IsoDate;
  totalAmount: number;
}

export interface ReservationDetail {
  id: Uuid;
  code: string;
  status: ReservationStatus;
  channel: ReservationChannel;
  channelReference: string | null;
  beds24BookingId: number | null;
  channelSyncNote: string | null;
  commissionAmount: number;
  roomType: Ref;
  room: Ref | null;
  ratePlan: Ref | null;
  holder: GuestSummary;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  expectedArrivalTime: IsoTime | null;
  adults: number;
  children: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  paymentMode: PaymentMode;
  specialRequests: string | null;
  internalNotes: string | null;
  holdExpiresAt: IsoInstant | null;
  checkedInAt: IsoInstant | null;
  checkedOutAt: IsoInstant | null;
  cancelledAt: IsoInstant | null;
  cancellationReason: string | null;
  createdAt: IsoInstant;
  version: number;
  nightCharges: NightPrice[];
  payments: PaymentLine[];
  invoices: InvoiceRef[];
}

export interface ManualReservationRequest {
  roomTypeId: Uuid;
  ratePlanId: Uuid | null;
  roomId: Uuid | null;
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  channel: ReservationChannel;
  channelReference: string | null;
  guestId: Uuid | null;
  guest: {
    firstName: string;
    lastName1: string;
    lastName2: string | null;
    email: string | null;
    phone: string | null;
    countryCode: string | null;
  } | null;
  totalAmountOverride: number | null;
  paymentMode: PaymentMode | null;
  specialRequests: string | null;
  internalNotes: string | null;
  expectedArrivalTime: IsoTime | null;
  locale: 'es' | 'en' | null;
  overrideRestrictions: boolean;
  sendConfirmation: boolean;
}

export interface ReservationNotesRequest {
  specialRequests: string | null;
  internalNotes: string | null;
  expectedArrivalTime: IsoTime | null;
  channelReference: string | null;
  version: number;
}

export interface StayChangeRequest {
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  totalAmountOverride: number | null;
  overrideRestrictions: boolean;
  version: number;
}

export interface PropertyPaymentRequest {
  provider: PaymentProvider;
  amount: number;
  reference: string | null;
}

export interface RefundRequest {
  amount: number;
  reason: string;
}

// ------------------------------------------------------------------ huéspedes

export interface StayHistoryItem {
  reservationId: Uuid;
  code: string;
  status: ReservationStatus;
  checkIn: IsoDate;
  checkOut: IsoDate;
  roomTypeName: string;
  totalAmount: number;
  holder: boolean;
}

export interface GuestDetail extends Omit<TravelerData, 'relationship'> {
  id: Uuid;
  preferredLocale: string;
  marketingConsent: boolean;
  privacyAcceptedAt: IsoInstant | null;
  notes: string | null;
  version: number;
  stays: StayHistoryItem[];
}

export interface GuestRequest extends Omit<TravelerData, 'relationship'> {
  preferredLocale: string | null;
  marketingConsent: boolean | null;
  notes: string | null;
  version: number;
}

// ------------------------------------------------------------------ PMS

export interface RackBooking {
  reservationId: Uuid;
  code: string;
  status: ReservationStatus;
  channel: ReservationChannel;
  guestName: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  adults: number;
  children: number;
  balanceDue: number;
  roomTypeId: Uuid;
}

export interface RackBlock {
  id: Uuid;
  startDate: IsoDate;
  endDate: IsoDate;
  blockType: BlockType;
  reason: string | null;
}

export interface RackRoom {
  id: Uuid;
  number: string;
  name: string | null;
  status: RoomStatus;
  housekeepingStatus: HousekeepingStatus;
  bookings: RackBooking[];
  blocks: RackBlock[];
}

export interface RackResponse {
  from: IsoDate;
  to: IsoDate;
  roomTypes: { id: Uuid; name: string; rooms: RackRoom[] }[];
  unassigned: RackBooking[];
}

export interface DashboardResponse {
  date: IsoDate;
  arrivals: ReservationSummary[];
  departures: ReservationSummary[];
  inHouse: number;
  pendingPaymentHolds: number;
  unassignedArrivals: number;
  activeRooms: number;
  occupiedRooms: number;
  occupancyPercent: number;
  revenueMonthToDate: number;
  adrMonthToDate: number;
  revparMonthToDate: number;
  invoicedMonthToDate: number;
  roomsByHousekeepingStatus: Partial<Record<HousekeepingStatus, number>>;
  openHousekeepingTasks: number;
  sesReportsNeedingAction: number;
  sesReportsOverdue: number;
  currency: string;
}

// ------------------------------------------------------------------ limpieza

export interface TaskResponse {
  id: Uuid;
  roomId: Uuid;
  roomNumber: string;
  roomHousekeepingStatus: HousekeepingStatus;
  reservationId: Uuid | null;
  taskType: TaskType;
  status: TaskStatus;
  priority: number;
  scheduledDate: IsoDate;
  dueBy: IsoInstant | null;
  assignedUserId: Uuid | null;
  notes: string | null;
  startedAt: IsoInstant | null;
  completedAt: IsoInstant | null;
  verifiedAt: IsoInstant | null;
  version: number;
}

export interface TaskRequest {
  roomId: Uuid;
  reservationId: Uuid | null;
  taskType: TaskType;
  scheduledDate: IsoDate;
  priority: number | null;
  dueBy: IsoInstant | null;
  assignedUserId: Uuid | null;
  notes: string | null;
}

// ------------------------------------------------------------------ facturación

export interface InvoiceParty {
  name: string;
  taxId: string | null;
  address: string | null;
  countryCode: string | null;
}

export interface InvoiceLine {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxableBase: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
}

export interface InvoiceResponse {
  id: Uuid;
  fullNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: IsoDate;
  operationDate: IsoDate | null;
  reservationId: Uuid | null;
  reservationCode: string | null;
  rectifiedInvoiceNumber: string | null;
  rectificationReason: string | null;
  issuer: InvoiceParty;
  customer: InvoiceParty;
  taxableBase: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  notes: string | null;
  lines: InvoiceLine[];
  verifactu: { status: VerifactuStatus; hash: string | null; previousHash: string | null; recordTimestamp: string | null };
  createdAt: IsoInstant;
}

export interface IssueInvoiceRequest {
  type: 'F1' | 'F2';
  customerName: string | null;
  customerTaxId: string | null;
  customerAddress: string | null;
  customerCountryCode: string | null;
  notes: string | null;
}

export interface RectifyInvoiceRequest {
  reason: string;
  amount: number | null;
}

// ------------------------------------------------------------------ SES.HOSPEDAJES

export interface SesReportSummary {
  id: Uuid;
  reservationId: Uuid;
  reservationCode: string;
  type: SesCommunicationType;
  operation: SesOperation;
  status: SesReportStatus;
  deadlineAt: IsoInstant | null;
  overdue: boolean;
  batchId: string | null;
  communicationCode: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  submittedAt: IsoInstant | null;
  acceptedAt: IsoInstant | null;
  createdAt: IsoInstant;
}

export interface SesReportDetail {
  summary: SesReportSummary;
  persons: { role: 'TI' | 'VI'; fullName: string; documentType: string | null; documentNumber: string | null; nationality: string | null }[];
  requestXml: string | null;
  responseXml: string | null;
}

// ------------------------------------------------------------------ cerraduras

export interface LockResponse {
  id: Uuid;
  externalLockId: number;
  name: string;
  lockType: LockType;
  roomId: Uuid | null;
  roomNumber: string | null;
  lockMac: string | null;
  gatewayId: number | null;
  hasGateway: boolean;
  batteryLevel: number | null;
  batteryUpdatedAt: IsoInstant | null;
  lowBattery: boolean;
  active: boolean;
  version: number;
}

export interface LockRequest {
  externalLockId: number;
  name: string;
  lockType: LockType;
  roomId: Uuid | null;
  lockMac: string | null;
  gatewayId: number | null;
  hasGateway: boolean;
  active: boolean;
  version: number | null;
}

export interface ProviderLock {
  externalLockId: number;
  name: string;
  lockMac: string | null;
  batteryLevel: number | null;
  hasGateway: boolean;
  registered: boolean;
}

export interface AccessLogEntry {
  id: number;
  lockDeviceId: Uuid;
  reservationId: Uuid | null;
  userId: Uuid | null;
  actorType: 'GUEST' | 'STAFF' | 'SYSTEM';
  action: 'REMOTE_UNLOCK' | 'PASSCODE_CREATE' | 'PASSCODE_DELETE' | 'LOCK_SYNC';
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
  denialReason: string | null;
  providerErrorCode: number | null;
  providerMessage: string | null;
  latencyMs: number | null;
  clientIp: string | null;
  occurredAt: IsoInstant;
}

// ------------------------------------------------------------------ channel manager

export interface Beds24Status {
  enabled: boolean;
  connected: boolean;
  pushBookings: boolean;
  syncHorizonDays: number;
  lastBookingPollAt: IsoInstant | null;
  pendingEvents: number;
  failedEvents: number;
  deadEvents: number;
  roomTypes: {
    roomTypeId: Uuid;
    code: string;
    name: string;
    active: boolean;
    beds24RoomId: number | null;
    units: number;
    unitsMapped: number;
  }[];
}

export interface Beds24RemoteRoom {
  propertyId: number | null;
  propertyName: string | null;
  beds24RoomId: number;
  name: string | null;
  qty: number | null;
  maxPeople: number | null;
  mappedRoomTypeId: Uuid | null;
  mappedRoomTypeCode: string | null;
  units: { beds24UnitId: number; name: string | null; mappedRoomNumber: string | null }[];
}

export interface Beds24PollSummary {
  total: number;
  counts: Partial<Record<ImportResult, number>>;
  deferred: number;
}
