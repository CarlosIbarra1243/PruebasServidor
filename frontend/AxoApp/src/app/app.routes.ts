import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AuthComponent } from './pages/auth/auth.component';
import { UserHomeComponent } from './users/pages/home/user-home.component';
import { AdminHomeComponent } from './admin/pages/home/admin-home.component';
import { AuthGuard } from './guards/auth.guard';
import { AdminComponent } from './admin/admin.component';
import { AdminDashboardComponent } from './admin/pages/dashboard/admin-dashboard.component';
import { AdminStatisticsComponent } from './admin/pages/statistics/admin-statistics.component';
import { AdminAlertsComponent } from './admin/pages/alerts/admin-alerts.component';
import { AddDeviceComponent } from './admin/pages/devices/add-device/add-device.component';
import { AdminDevicesComponent } from './admin/pages/devices/admin-devices/admin-devices.component';
import { AboutComponent } from './pages/about/about.component';
import { InfoComponent } from './pages/info/info.component';
import { ViewDeviceComponent } from './admin/pages/devices/view-device/view-device.component';
import { EditDeviceComponent } from './admin/pages/devices/edit-device/edit-device.component';
import { ListDeviceComponent } from './admin/pages/devices/list-device/list-device.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },
    {
        path: 'home',
        component: HomeComponent,
    },
    {
        path: 'about',
        component: AboutComponent
    },
    {
        path: 'info',
        component: InfoComponent
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
        path: 'admin',
        component: AdminComponent,
        canActivate: [AuthGuard],
        data: { rol: 2 },
        children: [
            {
                path: '',
                redirectTo: 'home',
                pathMatch:'full'
            },
            {
                path: 'home',
                component: AdminHomeComponent
            },
            {
                path: 'dashboard',
                component: AdminDashboardComponent
            },
            {
                path: 'stats',
                component: AdminStatisticsComponent
            },
            {
                path: 'alerts',
                component: AdminAlertsComponent
            },
            {
                path: 'devices',
                component: AdminDevicesComponent,
                children: [
                { path: '', redirectTo: 'list', pathMatch: 'full' },
                { path: 'list', component: ListDeviceComponent }, 
                { path: 'add', component: AddDeviceComponent },
                { path: 'view/:id', component: ViewDeviceComponent },
                { path: 'edit/:id', component: EditDeviceComponent }
                ]
            },
            {
                path: 'add-device',
                component: AddDeviceComponent
            },
            {
                path: '**',
                redirectTo: 'home',
                pathMatch: 'full'
            }
        ],
    },
    {
        path: '**',
        redirectTo: 'home',
        pathMatch: 'full'
    }
];
