import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AuthComponent } from './pages/auth/auth.component';
import { UserHomeComponent } from './users/pages/home/user-home.component';
import { AdminHomeComponent } from './admin/pages/home/admin-home.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: 'home',
        component: HomeComponent,
    },
    { 
        path: 'auth', 
        component: AuthComponent,
    },
    {
        path: 'users/home', 
        component: UserHomeComponent,
        canActivate: [AuthGuard],
        data: { rol: 1 },
    },
    {
        path: 'admin/home',
        component: AdminHomeComponent,
        canActivate: [AuthGuard],
        data: { rol: 2 },
    },
    {
        path: '**',
        redirectTo: 'home',
        pathMatch: 'full'
    }
];
