import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AuthComponent } from './pages/auth/auth.component';

export const routes: Routes = [
    {
        path: 'home',
        component: HomeComponent,
    },
    { 
        path: 'auth', 
        component: AuthComponent 
    },
    // {   path: 'admin', 
    //     component: AdminComponent, 
    //     canActivate: [AuthGuard]
    // }
    {
        path: '**',
        redirectTo: 'home',
        pathMatch: 'full'
    }
];
