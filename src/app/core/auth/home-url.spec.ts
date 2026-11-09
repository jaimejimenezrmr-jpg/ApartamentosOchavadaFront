import { UserRole } from '../api/models';
import { homeUrlFor } from './guards';
import { StaffSessionService } from './staff-session.service';

const RANK: Record<UserRole, number> = { HOUSEKEEPING: 1, RECEPTIONIST: 2, ADMIN: 3 };

function sessionWith(role: UserRole): StaffSessionService {
  return { hasRole: (required: UserRole) => RANK[role] >= RANK[required] } as unknown as StaffSessionService;
}

describe('homeUrlFor', () => {
  it('lleva a cada perfil a su página de inicio', () => {
    expect(homeUrlFor(sessionWith('ADMIN'))).toBe('/jarvis');
    expect(homeUrlFor(sessionWith('RECEPTIONIST'))).toBe('/backoffice/panel');
    expect(homeUrlFor(sessionWith('HOUSEKEEPING'))).toBe('/backoffice/limpieza');
  });
});
