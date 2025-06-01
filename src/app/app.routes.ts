import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ModuleDetailsComponent } from './components/module-details/module-details.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ApiExplorerComponent } from './components/api-explorer/api-explorer.component';
import { FileStorageComponent } from './components/file-storage/file-storage.component';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'modules/:id', component: ModuleDetailsComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'api-explorer', component: ApiExplorerComponent, canActivate: [authGuard] },
  { path: 'file-storage', component: FileStorageComponent, canActivate: [authGuard] },
];
