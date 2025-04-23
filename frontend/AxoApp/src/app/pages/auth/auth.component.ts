import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface RegisterForm {
  email: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent {
  loginForm: FormGroup<LoginForm>;
  registerForm: FormGroup<RegisterForm>;
  isLoginMode = true;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.createLoginForm();
    this.registerForm = this.createRegisterForm();
  }

  private createLoginForm(): FormGroup<LoginForm> {
    return this.fb.group<LoginForm>({
      email: this.fb.control('', {
        validators: [Validators.required, Validators.email],
        nonNullable: true
      }),
      password: this.fb.control('', {
        validators: [Validators.required, Validators.minLength(8)],
        nonNullable: true
      })
    });
  }

  private createRegisterForm(): FormGroup<RegisterForm> {
    return this.fb.group<RegisterForm>({
      email: this.fb.control('', {
        validators: [Validators.required, Validators.email],
        nonNullable: true
      }),
      password: this.fb.control('', {
        validators: [Validators.required, Validators.minLength(8)],
        nonNullable: true
      }),
      confirmPassword: this.fb.control('', {
        validators: [Validators.required],
        nonNullable: true
      })
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = null;

    this.loginForm.reset();
    this.registerForm.reset();

  // Marcar todos los controles como pristine para evitar errores visibles
    Object.values(this.loginForm.controls).forEach(control => control.markAsPristine());
    Object.values(this.registerForm.controls).forEach(control => control.markAsPristine());
  }

  onSubmit(): void {
    const form = this.isLoginMode ? this.loginForm : this.registerForm;

    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const { email, password } = form.getRawValue();
    console.log(form.getRawValue());
    console.log(email);
    console.log(password);

    const auth$ = this.isLoginMode
      ? this.authService.login({ email, password })
      : this.authService.register({ email, password });

    auth$.subscribe({
      next: () => {
        if (this.isLoginMode) {
          this.router.navigate(['/admin']);
        } else {
          this.isLoginMode = true;
          this.errorMessage = '¡Registro exitoso! Por favor, inicia sesión.';
          this.registerForm.reset();
        }
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error en el proceso de autenticación.';
      }
    });
  }
}
