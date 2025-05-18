import { Injectable } from "@angular/core";
import { CanActivate, Router, ActivatedRouteSnapshot } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const token = this.authService.getToken();
    const userRol = this.authService.getRol();
    const expectedRol = route.data['rol'];

    if (route.routeConfig?.path === 'auth' && token && userRol !== null) {
      this.router.navigate([userRol === 1 ? '/users/home' : '/admin/home']);
      return false;
    }

    if (!token) {
      this.router.navigate(['/auth']);
      return false;
    }

    if (userRol !== expectedRol) {
      this.router.navigate([userRol === 1 ? '/users/home' : '/admin/home']);
      return false;
    }

    return true;
  }
}