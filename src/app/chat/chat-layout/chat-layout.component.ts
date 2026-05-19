import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ChatPreview } from '../../models/message.model';
import { ChatListComponent } from '../chat-list/chat-list.component';
import { ChatWindowComponent } from '../chat-window/chat-window.component';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [CommonModule, ChatListComponent, ChatWindowComponent],
  templateUrl: './chat-layout.component.html',
  styleUrls: ['./chat-layout.component.scss'],
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private destroy$ = new Subject<void>();

  activeChatPreview: ChatPreview | null = null;
  isMobile = window.innerWidth < 768;

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  ngOnInit(): void {
    this.notificationService.requestPermission();
  }

  onChatSelected(preview: ChatPreview): void {
    this.activeChatPreview = preview;
  }

  onBackToList(): void {
    this.activeChatPreview = null;
  }

  get showList(): boolean {
    return !this.isMobile || !this.activeChatPreview;
  }

  get showWindow(): boolean {
    return !this.isMobile || !!this.activeChatPreview;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
