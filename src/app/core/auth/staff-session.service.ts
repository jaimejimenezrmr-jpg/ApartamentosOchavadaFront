import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap } from 'rxjs';
import { CurrentUser, StaffTokenResponse, UserRole } from '../api/models';
import { API_ORIGIN } from '../config/site-config';

const ROLE_RANK: Record<UserRole, number> = { HOUSEKEEPING: 1, RECEPTIONIST: 2, ADMIN: 3 };

/**
 * Sesión del personal. El access token (JWT, corta duración) vive solo en memoria; el refresh token es una
 * cookie HttpOnly `SameSite=Strict` que el navegador envía a `/api/v1/auth/refresh`. Así un XSS no puede
 * robar una credencial duradera y una recarga de página recupera la sesión con un refresh silencioso.
 */
@Injectable({ providedIn: 'root' })
export class StaffSessionService {
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly origin = inject(API_ORIGIN);
  /** Sin interceptores para evitar recursión en el refresh. */
  private readonly http = new HttpClient(inject(HttpBackend));

  private readonly token = signal<string | null>(null);
  private expiresAt = 0;
  private refreshing: Observable<string | null> | null = null;
  private restoring: Promise<boolean> | null = null;

  readonly user = signal<CurrentUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  accessToken(): string | null {
    return this.token();
  }

  /** ¿Tiene el usuario al menos el rol indicado? (ADMIN &gt; RECEPTIONIST &gt; HOUSEKEEPING) */
  hasRole(role: UserRole): boolean {
    const user = this.user();
    return user !== null && ROLE_RANK[user.role] >= ROLE_RANK[role];
  }

  async login(email: string, password: string): Promise<CurrentUser> {
    const response = await firstValueFrom(
      this.http.post<StaffTokenResponse>(`${this.origin}/api/v1/auth/login`, { email, password }, { withCredentials: true }),
    );
    this.apply(response);
    return response.user;
  }

  /** Recupera la sesión al cargar el backoffice (una sola vez por carga de página). */
  async restore(): Promise<boolean> {
    if (!this.isBrowser) return false;
    if (this.isAuthenticated()) return true;
    // Los guards del layout y de cada ruta llaman a la vez: comparten el mismo intento.
    this.restoring ??= firstValueFrom(this.refresh()).then((token) => token !== null);
    return this.restoring;
  }

  /** Access token vigente, renovándolo si caduca en menos de 30 s. */
  validToken(): Observable<string | null> {
    const token = this.token();
    if (token && Date.now() < this.expiresAt - 30_000) {
      return of(token);
    }
    return this.refresh();
  }

  /** Renueva con la cookie; peticiones simultáneas comparten la misma renovación. */
  refresh(): Observable<string | null> {
    if (!this.isBrowser) return of(null);
    this.refreshing ??= this.http
      .post<StaffTokenResponse>(`${this.origin}/api/v1/auth/refresh`, null, { withCredentials: true })
      .pipe(
        tap((response) => this.apply(response)),
        map((response) => response.accessToken),
        catchError(() => {
          this.clear();
          return of(null);
        }),
        finalize(() => (this.refreshing = null)),
        shareReplay(1),
      );
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.origin}/api/v1/auth/logout`, null, { withCredentials: true }));
    } catch {
      // La cookie se invalida igualmente al caducar; la sesión local se borra en cualquier caso.
    }
    this.clear();
    await this.router.navigate(['/backoffice/login']);
  }

  /** La API rechazó el token (revocado o usuario desactivado): vuelta al login. */
  async expire(returnUrl: string): Promise<void> {
    this.clear();
    await this.router.navigate(['/backoffice/login'], { queryParams: { returnUrl } });
  }

  private apply(response: StaffTokenResponse): void {
    this.token.set(response.accessToken);
    this.expiresAt = Date.parse(response.expiresAt);
    this.user.set(response.user);
  }

  private clear(): void {
    this.restoring = null;
    this.token.set(null);
    this.expiresAt = 0;
    this.user.set(null);
  }
}
