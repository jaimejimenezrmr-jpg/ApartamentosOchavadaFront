/** Motivos que impiden el autocheck-in (`DoorsResponse.selfCheckIn.blockers`). */
export const SELF_CHECKIN_BLOCKER: Record<string, string> = {
  ALREADY_CHECKED_IN: 'El check-in ya está hecho.',
  RESERVATION_NOT_CONFIRMED: 'La reserva no está confirmada.',
  TOO_EARLY: 'Todavía no es la hora de entrada.',
  STAY_ENDED: 'La estancia ya ha terminado.',
  ROOM_NOT_ASSIGNED: 'Estamos asignando su apartamento; contacte con nosotros si llega pronto.',
  ROOM_NOT_READY: 'Su apartamento se está preparando. Inténtelo de nuevo en unos minutos.',
  BALANCE_DUE: 'Hay un importe pendiente de pago. Contacte con nosotros.',
  ONLINE_CHECKIN_PENDING: 'Complete antes el registro de viajeros.',
};

/** Motivos por los que una puerta no puede abrirse (`Door.reason`, códigos `DenialReason`). */
export const DOOR_REASON: Record<string, string> = {
  RESERVATION_NOT_CHECKED_IN: 'Disponible tras hacer el check-in.',
  OUTSIDE_STAY_WINDOW: 'Fuera del horario de su estancia.',
  TOKEN_REVOKED: 'El acceso ya no es válido.',
  LOCK_NOT_ASSIGNED: 'Esta puerta no tiene cerradura digital asignada.',
  LOCK_INACTIVE: 'La cerradura está temporalmente fuera de servicio.',
  RATE_LIMITED: 'Demasiados intentos; espere un momento.',
  NOT_AUTHORIZED: 'No autorizado.',
};
