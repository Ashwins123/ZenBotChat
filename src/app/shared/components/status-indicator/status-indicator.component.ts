import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge" [class]="status">
      <span class="dot"></span>
      @if (showLabel) { {{ status | titlecase }} }
    </span>
  `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;
      font-weight: 500;

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      &.online { color: #22c55e; .dot { background: #22c55e; animation: pulse 2s infinite; } }
      &.offline { color: var(--text-muted); .dot { background: #94a3b8; } }
      &.away { color: #f59e0b; .dot { background: #f59e0b; } }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `]
})
export class StatusIndicatorComponent {
  @Input() status: 'online' | 'offline' | 'away' = 'offline';
  @Input() showLabel = true;
}
