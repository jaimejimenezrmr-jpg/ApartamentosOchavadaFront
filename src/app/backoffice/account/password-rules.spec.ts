import { passwordProblem } from './password-rules';

describe('passwordProblem', () => {
  it('aplica las mismas reglas que el backend', () => {
    expect(passwordProblem('corta', null)).toContain('12');
    expect(passwordProblem('a'.repeat(65), null)).toContain('64');
    expect(passwordProblem('aaaaaaaaaaaaaa', null)).toContain('repetido');
    expect(passwordProblem('soy-ana.garcia-2026', 'ana.garcia@ochavada.com')).toContain('email');
    expect(passwordProblem('una frase larga y propia', 'ana@ochavada.com')).toBeNull();
  });
});
