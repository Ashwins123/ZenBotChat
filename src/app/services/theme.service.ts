import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private darkMode = new BehaviorSubject<boolean>(false);
  isDarkMode$ = this.darkMode.asObservable();

  constructor() {
    const saved = localStorage.getItem('zenbot-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    this.setTheme(isDark);
  }

  toggleTheme(): void {
    this.setTheme(!this.darkMode.value);
  }

  setTheme(dark: boolean): void {
    this.darkMode.next(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('zenbot-theme', dark ? 'dark' : 'light');
  }

  get isDark(): boolean {
    return this.darkMode.value;
  }
}
