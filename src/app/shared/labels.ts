import {
  AmenityCategory,
  BlockType,
  DayOfWeek,
  DocumentType,
  HousekeepingStatus,
  InvoiceType,
  LockType,
  MealPlan,
  PaymentMode,
  PaymentProvider,
  PaymentStatus,
  PriceSource,
  ReservationChannel,
  ReservationStatus,
  RoomStatus,
  SesCommunicationType,
  SesOperation,
  SesReportStatus,
  TaskStatus,
  TaskType,
  UserRole,
  VerifactuStatus,
} from '../core/api/models';

/** Textos en español de los valores enumerados de la API. */

export const RESERVATION_STATUS: Record<ReservationStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'En casa',
  CHECKED_OUT: 'Salida',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No presentado',
};

export const CHANNEL: Record<ReservationChannel, string> = {
  DIRECT: 'Web propia',
  BOOKING_COM: 'Booking.com',
  AIRBNB: 'Airbnb',
  EXPEDIA: 'Expedia',
  GOOGLE: 'Google',
  BEDS24_OTHER: 'Otro canal',
  PHONE: 'Teléfono',
  WALK_IN: 'Mostrador',
};

/** Canales que recepción puede elegir al dar de alta una reserva a mano. */
export const MANUAL_CHANNELS: ReservationChannel[] = ['PHONE', 'WALK_IN', 'BOOKING_COM', 'AIRBNB', 'EXPEDIA', 'BEDS24_OTHER'];

export const PAYMENT_MODE: Record<PaymentMode, string> = {
  ONLINE: 'Prepago online',
  AT_PROPERTY: 'Pago en el alojamiento',
  OTA_COLLECT: 'Cobra la OTA',
};

export const PAYMENT_PROVIDER: Record<PaymentProvider, string> = {
  STRIPE: 'Tarjeta online',
  CASH: 'Efectivo',
  CARD_TERMINAL: 'Datáfono',
  BANK_TRANSFER: 'Transferencia',
  OTA: 'OTA',
};

export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  PENDING: 'Pendiente',
  REQUIRES_ACTION: 'Requiere acción',
  SUCCEEDED: 'Cobrado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
  PARTIALLY_REFUNDED: 'Reembolsado en parte',
  REFUNDED: 'Reembolsado',
};

export const MEAL_PLAN: Record<MealPlan, string> = {
  ROOM_ONLY: 'Solo alojamiento',
  BREAKFAST: 'Desayuno incluido',
  HALF_BOARD: 'Media pensión',
  FULL_BOARD: 'Pensión completa',
};

export const PRICE_SOURCE: Record<PriceSource, string> = {
  DAILY_OVERRIDE: 'Ajuste diario',
  SEASON_WEEKEND: 'Temporada (fin de semana)',
  SEASON: 'Temporada',
  BASE: 'Precio base',
};

export const ROLE: Record<UserRole, string> = {
  ADMIN: 'Administración',
  RECEPTIONIST: 'Recepción',
  HOUSEKEEPING: 'Limpieza',
};

export const ROOM_STATUS: Record<RoomStatus, string> = {
  ACTIVE: 'Operativa',
  OUT_OF_ORDER: 'Fuera de servicio',
  INACTIVE: 'Inactiva',
};

export const HOUSEKEEPING_STATUS: Record<HousekeepingStatus, string> = {
  CLEAN: 'Limpia',
  DIRTY: 'Sucia',
  IN_PROGRESS: 'Limpiando',
  INSPECTED: 'Revisada',
  OUT_OF_SERVICE: 'Fuera de servicio',
};

export const BLOCK_TYPE: Record<BlockType, string> = {
  MAINTENANCE: 'Mantenimiento',
  OWNER_USE: 'Uso del propietario',
  OUT_OF_ORDER: 'Avería',
  OTHER: 'Otro',
};

export const AMENITY_CATEGORY: Record<AmenityCategory, string> = {
  GENERAL: 'General',
  KITCHEN: 'Cocina',
  BATHROOM: 'Baño',
  BEDROOM: 'Dormitorio',
  ENTERTAINMENT: 'Ocio',
  ACCESSIBILITY: 'Accesibilidad',
  OUTDOOR: 'Exterior',
  SERVICES: 'Servicios',
};

export const TASK_STATUS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  DONE: 'Hecha',
  VERIFIED: 'Verificada',
  CANCELLED: 'Cancelada',
};

export const TASK_TYPE: Record<TaskType, string> = {
  CHECKOUT_CLEAN: 'Limpieza de salida',
  STAYOVER_CLEAN: 'Repaso en estancia',
  DEEP_CLEAN: 'Limpieza a fondo',
  INSPECTION: 'Revisión',
  MAINTENANCE: 'Mantenimiento',
  LINEN_CHANGE: 'Cambio de ropa',
};

export const DOCUMENT_TYPE: Record<DocumentType, string> = {
  NIF: 'DNI / NIF',
  NIE: 'NIE',
  PAS: 'Pasaporte',
  OTRO: 'Otro documento',
};

export const INVOICE_TYPE: Record<InvoiceType, string> = {
  F1: 'Factura completa',
  F2: 'Factura simplificada',
  R1: 'Rectificativa (R1)',
  R2: 'Rectificativa (R2)',
  R3: 'Rectificativa (R3)',
  R4: 'Rectificativa (R4)',
  R5: 'Rectificativa simplificada',
};

export const VERIFACTU_STATUS: Record<VerifactuStatus, string> = {
  NOT_APPLICABLE: 'No aplica',
  PENDING: 'Pendiente de envío',
  SENT: 'Enviado',
  ACCEPTED: 'Aceptado',
  ACCEPTED_WITH_ERRORS: 'Aceptado con errores',
  REJECTED: 'Rechazado',
};

export const LOCK_TYPE: Record<LockType, string> = {
  MAIN_ENTRANCE: 'Entrada principal',
  ROOM: 'Unidad',
  COMMON_AREA: 'Zona común',
};

export const SES_TYPE: Record<SesCommunicationType, string> = {
  RESERVATION: 'Reserva (RH)',
  TRAVELER_ENTRY: 'Parte de viajeros (PV)',
};

export const SES_OPERATION: Record<SesOperation, string> = {
  A: 'Alta',
  M: 'Modificación',
  B: 'Anulación',
};

export const SES_STATUS: Record<SesReportStatus, string> = {
  DRAFT: 'Borrador (faltan datos)',
  PENDING: 'En cola',
  SUBMITTED: 'Enviada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  ERROR: 'Error',
  CANCELLED: 'Anulada',
};

export const DAY_OF_WEEK: { value: DayOfWeek; short: string }[] = [
  { value: 'MONDAY', short: 'L' },
  { value: 'TUESDAY', short: 'M' },
  { value: 'WEDNESDAY', short: 'X' },
  { value: 'THURSDAY', short: 'J' },
  { value: 'FRIDAY', short: 'V' },
  { value: 'SATURDAY', short: 'S' },
  { value: 'SUNDAY', short: 'D' },
];

/** Parentesco del viajero menor con el adulto responsable (códigos SES.HOSPEDAJES). */
export const RELATIONSHIP: { code: string; label: string }[] = [
  { code: 'PM', label: 'Padre o madre' },
  { code: 'TU', label: 'Tutor/a' },
  { code: 'AB', label: 'Abuelo/a' },
  { code: 'HR', label: 'Hermano/a' },
  { code: 'TI', label: 'Tío/a' },
  { code: 'SB', label: 'Sobrino/a' },
  { code: 'BA', label: 'Bisabuelo/a' },
  { code: 'BN', label: 'Bisnieto/a' },
  { code: 'CD', label: 'Cuñado/a' },
  { code: 'CY', label: 'Cónyuge' },
  { code: 'HJ', label: 'Hijo/a' },
  { code: 'NI', label: 'Nieto/a' },
  { code: 'SG', label: 'Suegro/a' },
  { code: 'YN', label: 'Yerno o nuera' },
  { code: 'OT', label: 'Otro' },
];

/** Tono visual de cada estado (clases `badge--*`). */
export function reservationTone(status: ReservationStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'info';
    case 'CHECKED_IN':
      return 'success';
    case 'PENDING_PAYMENT':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function sesTone(status: SesReportStatus): string {
  switch (status) {
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
    case 'ERROR':
      return 'danger';
    case 'DRAFT':
      return 'warning';
    case 'SUBMITTED':
    case 'PENDING':
      return 'info';
    default:
      return 'neutral';
  }
}

export function housekeepingTone(status: HousekeepingStatus): string {
  switch (status) {
    case 'CLEAN':
    case 'INSPECTED':
      return 'success';
    case 'DIRTY':
      return 'danger';
    case 'IN_PROGRESS':
      return 'warning';
    default:
      return 'neutral';
  }
}
