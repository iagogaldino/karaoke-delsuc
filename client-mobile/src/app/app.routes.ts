import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'qrcode/:qrId',
    loadComponent: () => import('./pages/qrcode-page/qrcode-page.component').then(m => m.QrcodePageComponent)
  },
  {
    path: 'register/:qrId',
    loadComponent: () => import('./pages/register-page/register-page.component').then(m => m.RegisterPageComponent)
  },
  {
    path: 'songs/:qrId',
    loadComponent: () => import('./pages/songs-page/songs-page.component').then(m => m.SongsPageComponent)
  },
  {
    path: 'player/:qrId',
    loadComponent: () => import('./pages/player-page/player-page.component').then(m => m.PlayerPageComponent)
  },
  {
    path: 'error',
    loadComponent: () => import('./pages/error-page/error-page.component').then(m => m.ErrorPageComponent)
  },
  {
    path: '',
    redirectTo: '/error',
    pathMatch: 'full'
  }
];

