import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = false;
  error = '';
  success = '';

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = '';
    this.success = '';
    try {
      await this.authService.resetPassword(this.form.value.email);
      this.success = 'Password reset email sent! Check your inbox.';
      this.form.reset();
    } catch (e: any) {
      this.error =
        e.code === 'auth/user-not-found'
          ? 'No account found with this email.'
          : 'Failed to send reset email. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}
