import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avatar" [ngStyle]="{ width: size + 'px', height: size + 'px' }">
      @if (photoURL && !imgError) {
        <img [src]="photoURL" [alt]="name" (error)="imgError = true" />
      } @else {
        <div class="avatar-initials" [ngStyle]="{ fontSize: (size * 0.38) + 'px', background: getColor(name) }">
          {{ getInitials(name) }}
        </div>
      }
      @if (showStatus) {
        <span class="status-dot" [class]="status"></span>
      }
    </div>
  `,
  styles: [`
    .avatar {
      position: relative;
      border-radius: 50%;
      overflow: visible;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
      }
    }
    .avatar-initials {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-family: inherit;
    }
    .status-dot {
      position: absolute;
      bottom: 1px;
      right: 1px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid var(--bg-primary);

      &.online { background: #22c55e; }
      &.offline { background: #94a3b8; }
      &.away { background: #f59e0b; }
    }
  `]
})
export class AvatarComponent {
  @Input() name = '';
  @Input() photoURL = '';
  @Input() size = 40;
  @Input() status: 'online' | 'offline' | 'away' = 'offline';
  @Input() showStatus = false;

  imgError = false;

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
  }

  getColor(name: string): string {
    const colors = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#10b981','#0ea5e9','#14b8a6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
}
