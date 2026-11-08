import { barPosition } from './rack-layout';

describe('barPosition', () => {
  const from = '2026-11-10';
  const to = '2026-11-24';

  it('coloca una estancia dentro del rango', () => {
    expect(barPosition('2026-11-12', '2026-11-15', from, to)).toEqual({ column: 3, span: 3, clippedStart: false, clippedEnd: false });
  });

  it('recorta las estancias que empiezan antes o terminan después', () => {
    expect(barPosition('2026-11-05', '2026-11-12', from, to)).toEqual({ column: 1, span: 2, clippedStart: true, clippedEnd: false });
    expect(barPosition('2026-11-20', '2026-12-02', from, to)).toEqual({ column: 11, span: 4, clippedStart: false, clippedEnd: true });
    expect(barPosition('2026-11-01', '2026-12-01', from, to)).toEqual({ column: 1, span: 14, clippedStart: true, clippedEnd: true });
  });

  it('ignora estancias fuera del rango (la salida no ocupa noche)', () => {
    expect(barPosition('2026-11-01', '2026-11-10', from, to)).toBeNull();
    expect(barPosition('2026-11-24', '2026-11-26', from, to)).toBeNull();
  });
});
