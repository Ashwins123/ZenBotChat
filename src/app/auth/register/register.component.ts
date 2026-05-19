import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password');
  const confirm = control.get('confirmPassword');
  if (password && confirm && password.value !== confirm.value) {
    confirm.setErrors({ mismatch: true });
  } else {
    confirm?.setErrors(null);
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  registerForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required]
  }, { validators: passwordMatchValidator });

  loading = false;
  googleLoading = false;
  error = '';
  success = '';
  showPassword = false;
  showConfirm = false;

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }
    this.loading = true;
    this.error = '';
    try {
      await this.authService.register(
        this.registerForm.value.name,
        this.registerForm.value.email,
        this.registerForm.value.password
      );
      this.router.navigate(['/chat']);
    } catch (e: any) {
      this.error = this.getErrorMessage(e.code);
    } finally {
      this.loading = false;
    }
  }

  async loginWithGoogle(): Promise<void> {
    this.googleLoading = true;
    try {
      await this.authService.loginWithGoogle();
      this.router.navigate(['/chat']);
    } catch (e: any) {
      this.error = this.getErrorMessage(e.code);
    } finally {
      this.googleLoading = false;
    }
  }

  private getErrorMessage(code: string): string {
    const messages: { [key: string]: string } = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password is too weak.',
      'auth/invalid-email': 'Please enter a valid email address.'
    };
    return messages[code] || 'An error occurred. Please try again.';
  }
}
