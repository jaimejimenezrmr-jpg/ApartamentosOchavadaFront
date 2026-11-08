import { addDays, addMonths, eachDay, isIsoDate, nightsBetween, startOfMonth, startOfWeek, todayInProperty, weekdayIndex } from './dates';

describe('dates', () => {
  it('suma días cruzando meses, años y el cambio de hora', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('cuenta noches como intervalo semiabierto', () => {
    expect(nightsBetween('2026-10-24', '2026-10-27')).toBe(3);
    expect(eachDay('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(eachDay('2026-10-24', '2026-10-24')).toEqual([]);
  });

  it('valida fechas de calendario reales', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2027-13-01')).toBe(false);
    expect(isIsoDate('1/2/2027')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it('calcula semanas que empiezan en lunes y meses', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0);
    expect(weekdayIndex('2026-11-08')).toBe(6);
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02');
    expect(startOfMonth('2026-11-18')).toBe('2026-11-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('usa la fecha de Madrid aunque en UTC sea otro día', () => {
    expect(todayInProperty(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
    expect(todayInProperty(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31');
    expect(todayInProperty(new Date('2026-12-31T23:01:00Z'))).toBe('2027-01-01');
  });
});
