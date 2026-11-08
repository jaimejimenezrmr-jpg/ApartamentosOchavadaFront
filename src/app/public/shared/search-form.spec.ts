import { validateStay } from './search-form.component';

describe('validateStay', () => {
  const today = '2026-11-07';

  it('acepta estancias válidas', () => {
    expect(validateStay('2026-11-07', '2026-11-08', today)).toBeNull();
    expect(validateStay('2026-12-01', '2026-12-31', today)).toBeNull();
  });

  it('rechaza fechas pasadas, invertidas, vacías o demasiado largas', () => {
    expect(validateStay('2026-11-06', '2026-11-08', today)).toContain('anterior a hoy');
    expect(validateStay('2026-11-10', '2026-11-10', today)).toContain('posterior');
    expect(validateStay('', '2026-11-10', today)).toContain('Indique');
    expect(validateStay('2026-12-01', '2027-01-01', today)).toContain('30 noches');
  });
});
