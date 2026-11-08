import { inject, signal } from '@angular/core';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import { ToastService } from './toast.service';

/**
 * Ejecuta operaciones contra la API con indicador de «ocupado», aviso de éxito y aviso de error (RFC 7807).
 * Debe crearse en un contexto de inyección (inicializador de campo de un componente).
 */
export function useAction() {
  const toast = inject(ToastService);
  const busy = signal(false);

  async function run<T>(operation: () => Observable<T> | Promise<T>, success?: string | ((result: T) => string)): Promise<T | null> {
    if (busy()) return null;
    busy.set(true);
    try {
      const pending = operation();
      const result = isObservable(pending) ? await firstValueFrom(pending) : await pending;
      if (success) toast.success(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (error) {
      toast.error(error);
      return null;
    } finally {
      busy.set(false);
    }
  }

  /** Para operaciones sin cuerpo de respuesta (204): `true` si terminó sin error. */
  async function runOk(operation: () => Observable<unknown> | Promise<unknown>, success?: string): Promise<boolean> {
    let ok = false;
    await run(async () => {
      const pending = operation();
      await (isObservable(pending) ? firstValueFrom(pending, { defaultValue: null }) : pending);
      ok = true;
    }, success);
    return ok;
  }

  return { busy: busy.asReadonly(), run, runOk };
}
