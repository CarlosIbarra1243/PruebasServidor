import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';


@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule, 
    MatTabsModule, 
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatCardModule
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent {
  loginForm: FormGroup;
  registerForm: FormGroup;
  selectedTabIndex = 0;
  hidePassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    this.registerForm = this.fb.group({
      nombre: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      fechaNacimiento: ['', Validators.required],
      genero: ['', Validators.required],
      password: ['', [
        Validators.required,
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      ]],
    });
  }

  onSubmit(type: 'login' | 'register') {
    if (type === 'login' && this.loginForm.valid) {
      console.log(this.loginForm.value);
      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          const rol = this.authService.getRol();
          if (rol === 1) {
            this.router.navigate(['/users/home']);
          } else if (rol === 2) {
            this.router.navigate(['/admin/home']);
          }
        },
        error: (err) => this.snackBar.open('Fallo en inicio de sesión. Por favor, intente nuevamente', 'Cerrar', { duration: 5000 }),
      });
    } else if (type === 'register' && this.registerForm.valid) {
      const user = this.registerForm.value;
      user.rol = 1; // Por defecto, rol de usuario común
      user.fechaNacimiento = this.dateFormat(user.fechaNacimiento);
      console.log(this.registerForm.value);
      this.authService.register(user).subscribe({
        next: () => {
          this.snackBar.open('¡Registro exitoso! Por favor, inicie sesión.', 'Cerrar', { duration: 5000 });
          this.selectedTabIndex = 0;
        },
        error: (err) => this.snackBar.open('Fallo en el registro', 'Cerrar', { duration: 5000 }),
      });
    }
  }

  private dateFormat(date: Date) : String {
    const year = date.getFullYear;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
