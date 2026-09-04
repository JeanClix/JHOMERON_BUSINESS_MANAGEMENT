import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'ventas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/ventas/ventas.component').then(m => m.VentasComponent)
  },
  {
    path: 'gerencia',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['gerencia'] },
    loadComponent: () => import('./features/gerencia/layout/gerencia-layout.component').then(m => m.GerenciaLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/gerencia/pages/dashboard/gerencia-dashboard.component').then(m => m.GerenciaDashboardComponent)
      },
      {
        path: 'analisis',
        loadComponent: () => import('./features/gerencia/pages/analisis/gerencia-analisis.component').then(m => m.GerenciaAnalisisComponent)
      },
      {
        path: 'documentacion',
        loadComponent: () => import('./features/gerencia/pages/documentacion/gerencia-documentacion.component').then(m => m.GerenciaDocumentacionComponent)
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/gerencia/pages/chat/gerencia-chat-page.component').then(m => m.GerenciaChatPageComponent)
      },
      {
        path: 'insights',
        loadComponent: () => import('./features/gerencia/pages/insights/gerencia-insights.component').then(m => m.GerenciaInsightsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
