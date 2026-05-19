import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { AuthService } from '../services/auth.service';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait until onAuthStateChanged has finished (including Firestore profile fetch)
  return authService.initialized$.pipe(
    filter(ready => ready),
    take(1),
    map(() => {
      if (authService.currentUser) return true;
      router.navigate(['/auth/login']);
      return false;
    })
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (!user) return true;
      router.navigate(['/chat']);
      return false;
    })
  );
};
