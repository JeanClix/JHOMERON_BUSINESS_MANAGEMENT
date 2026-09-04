import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

/**
 * Guarda que protege rutas requiriendo autenticación activa.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Guarda que restringe acceso a rutas basándose en roles específicos.
 * Se configura en la ruta con `data: { roles: ['gerencia'] }` o similar.
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  if (!currentUser) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles = (route.data?.['roles'] as UserRole[]) || [];
  if (allowedRoles.length === 0 || allowedRoles.includes(currentUser.role)) {
    return true;
  }

  // Redirigir a la ruta por defecto según el rol actual del usuario si no tiene permiso
  const defaultRoute = authService.getDefaultRouteForRole(currentUser.role);
  return router.createUrlTree([defaultRoute]);
};

/**
 * Guarda para la pantalla de login: si el usuario ya está autenticado,
 * lo redirige automáticamente a su panel correspondiente.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  if (currentUser) {
    const destination = authService.getDefaultRouteForRole(currentUser.role);
    return router.createUrlTree([destination]);
  }

  return true;
};
