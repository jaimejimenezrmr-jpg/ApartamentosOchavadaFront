import { Injectable, signal } from '@angular/core';
import { problemMessage } from '../../core/api/problem';

export interface Toast {
  id: number;
  kind: 'success' | 'danger' | 'info';
  message: string;
}

/** Avisos breves no bloqueantes (esquina inferior). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void {
    this.push('success', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  error(errorOrMessage: unknown): void {
    this.push('danger', typeof errorOrMessage === 'string' ? errorOrMessage : problemMessage(errorOrMessage), 8000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string, ttl = 4500): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ttl);
  }
}
