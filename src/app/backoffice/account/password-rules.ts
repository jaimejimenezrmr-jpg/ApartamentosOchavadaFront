/** Mismas reglas que el backend (PasswordPolicy), para avisar antes de enviar. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 64;

export function passwordProblem(password: string, email: string | null): string | null {
  if (password.length < PASSWORD_MIN) return `Al menos ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX || new TextEncoder().encode(password).length > 72) {
    return `Como máximo ${PASSWORD_MAX} caracteres`;
  }
  if (new Set(password).size === 1) return 'No puede ser un único carácter repetido';
  const local = (email ?? '').toLowerCase().split('@')[0];
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'No puede contener su email';
  return null;
}
