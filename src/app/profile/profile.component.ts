import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { User } from '../models/user.model';
import { AvatarComponent } from '../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AvatarComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);

  currentUser!: User;
  form!: FormGroup;
  loading = false;
  success = '';
  error = '';
  avatarPreview = '';
  selectedFile: File | null = null;

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser!;
    this.form = this.fb.group({
      name: [this.currentUser.name, [Validators.required, Validators.minLength(2)]],
      bio: [this.currentUser.bio || ''],
      phone: [this.currentUser.phone || ''],
    });
  }

  onAvatarChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { this.error = 'Image must be under 5MB'; return; }
    this.selectedFile = file;
    this.avatarPreview = URL.createObjectURL(file);
  }

  async onSave(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.error = '';
    this.success = '';
    try {
      if (this.selectedFile) {
        await this.authService.uploadAvatar(this.currentUser.uid, this.selectedFile);
      }
      await this.authService.updateProfile(this.currentUser.uid, {
        name: this.form.value.name.trim(),
        bio: this.form.value.bio.trim(),
        phone: this.form.value.phone.trim(),
      });
      this.currentUser = this.authService.currentUser!;
      this.success = 'Profile updated successfully!';
    } catch {
      this.error = 'Failed to update profile. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }
}
