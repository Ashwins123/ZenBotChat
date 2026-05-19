import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    @for (item of items; track $index) {
      <div class="skeleton-item">
        <div class="skeleton-avatar pulse"></div>
        <div class="skeleton-content">
          <div class="skeleton-line pulse" style="width: 60%; height: 14px;"></div>
          <div class="skeleton-line pulse" style="width: 85%; height: 12px; margin-top: 6px;"></div>
        </div>
        <div class="skeleton-meta">
          <div class="skeleton-line pulse" style="width: 40px; height: 11px;"></div>
        </div>
      </div>
    }
  `,
  styles: [`
    .skeleton-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
    }
    .skeleton-avatar {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--skeleton-color);
    }
    .skeleton-content { flex: 1; }
    .skeleton-meta { align-self: flex-start; margin-top: 4px; }
    .skeleton-line {
      border-radius: 6px;
      background: var(--skeleton-color);
    }
    .pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `]
})
export class SkeletonComponent {
  @Input() count = 6;
  get items() { return Array(this.count).fill(0); }
}
