import { Signal, computed } from '@angular/core';
import { RxResourceOptions, rxResource } from '@angular/core/rxjs-interop';

/**
 * `rxResource` con una señal `data()` que devuelve `undefined` mientras carga o si la petición falló.
 * Leer `value()` de un recurso con error lanza una excepción; `data()` permite usar el último valor en
 * plantillas, `computed` y efectos sin comprobar antes el estado (el error se consulta con `error()`).
 */
export function apiResource<T, R>(options: RxResourceOptions<T, R>) {
  const ref = rxResource(options);
  const data: Signal<T | undefined> = computed(() => (ref.hasValue() ? ref.value() : undefined));
  return Object.assign(ref, { data });
}
