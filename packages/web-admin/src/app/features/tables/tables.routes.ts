import type { Routes } from '@angular/router'

export const TABLE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/table-list/table-list.component').then(m => m.TableListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/table-form/table-form.component').then(m => m.TableFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/table-form/table-form.component').then(m => m.TableFormComponent)
  }
]
