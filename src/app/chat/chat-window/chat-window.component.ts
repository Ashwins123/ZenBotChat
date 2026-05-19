import {
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { AiService } from '../../services/ai.service';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';
import { Message } from '../../models/message.model';
import { ChatPreview } from '../../models/message.model';
import { User } from '../../models/user.model';
import { MessageInputComponent } from '../message-input/message-input.component';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { StatusIndicatorComponent } from '../../shared/components/status-indicator/status-indicator.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageInputComponent, AvatarComponent, StatusIndicatorComponent],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatWindowComponent implements OnChanges, OnDestroy {
  @Input() chatPreview: ChatPreview | null = null;
  @Output() backToList = new EventEmitter<void>();

  @ViewChild('messagesEl') messagesEl!: ElementRef<HTMLDivElement>;

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private aiService = inject(AiService);
  private notificationService = inject(NotificationService);
  themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  currentUser!: User;
  messages: Message[] = [];
  isTyping = false;
  replyMessage: Message | null = null;
  prefillText = '';

  showAiPanel = false;
  showGroupInfo = false;
  showReactionPicker: string | null = null;

  editingMessageId: string | null = null;
  editText = '';

  aiLoading = false;
  smartReplies: string[] = [];
  chatSummary = '';
  aiQuestion = '';
  aiAnswer = '';

  readonly reactions = ['❤️', '👍', '😂', '😮', '😢', '😡'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chatPreview']) {
      this.destroy$.next();
      this.destroy$ = new Subject<void>();
      this.messages = [];
      this.replyMessage = null;
      this.showAiPanel = false;
      this.showGroupInfo = false;
      this.smartReplies = [];
      this.chatSummary = '';
      this.aiAnswer = '';
      if (this.chatPreview) {
        this.currentUser = this.authService.currentUser!;
        this.listenToChat();
      }
    }
  }

  private listenToChat(): void {
    const { chatId, isGroup } = this.chatPreview!;

    this.chatService.listenToMessages(chatId, isGroup);

    this.chatService.messages$.pipe(takeUntil(this.destroy$)).subscribe((msgs) => {
      const isNew = msgs.length > this.messages.length;
      this.messages = msgs;
      this.cdr.markForCheck();
      if (isNew) {
        this.scrollToBottom();
        const last = msgs[msgs.length - 1];
        if (last && last.senderId !== this.currentUser.uid && document.hidden) {
          this.notificationService.show(this.chatPreview!.name, last.message);
        }
      }
    });

    this.chatService.listenToTyping(chatId, isGroup).pipe(takeUntil(this.destroy$)).subscribe((typing) => {
      this.isTyping = typing;
      this.cdr.markForCheck();
    });

    this.chatService.markMessagesAsSeen(chatId, this.currentUser.uid, isGroup);
  }

  scrollToBottom(smooth = false): void {
    setTimeout(() => {
      const el = this.messagesEl?.nativeElement;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }, 60);
  }

  onMessageSent(): void {
    this.scrollToBottom(true);
    this.prefillText = '';
  }

  setReply(msg: Message): void {
    this.replyMessage = msg;
    this.showReactionPicker = null;
  }

  clearReply(): void {
    this.replyMessage = null;
  }

  startEdit(msg: Message): void {
    this.editingMessageId = msg.id;
    this.editText = msg.message;
    this.showReactionPicker = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editingMessageId || !this.chatPreview || !this.editText.trim()) return;
    await this.chatService.editMessage(
      this.chatPreview.chatId,
      this.editingMessageId,
      this.editText.trim(),
      this.chatPreview.isGroup
    );
    this.editingMessageId = null;
    this.editText = '';
  }

  cancelEdit(): void {
    this.editingMessageId = null;
    this.editText = '';
  }

  async deleteMessage(msgId: string): Promise<void> {
    if (!this.chatPreview) return;
    await this.chatService.deleteMessage(this.chatPreview.chatId, msgId, this.chatPreview.isGroup);
  }

  toggleReactionPicker(msgId: string): void {
    this.showReactionPicker = this.showReactionPicker === msgId ? null : msgId;
  }

  async addReaction(msgId: string, emoji: string): Promise<void> {
    if (!this.chatPreview) return;
    await this.chatService.addReaction(
      this.chatPreview.chatId,
      msgId,
      emoji,
      this.currentUser.uid,
      this.chatPreview.isGroup
    );
    this.showReactionPicker = null;
  }

  isOwn(msg: Message): boolean {
    return msg.senderId === this.currentUser?.uid;
  }

  isSameDay(a: Message, b: Message): boolean {
    return this.msgDate(a)?.toDateString() === this.msgDate(b)?.toDateString();
  }

  msgDate(msg: Message): Date | null {
    if (!msg.timestamp) return null;
    return msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
  }

  formatDateLabel(msg: Message): string {
    const date = this.msgDate(msg);
    if (!date) return '';
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  formatTime(msg: Message): string {
    const d = this.msgDate(msg);
    return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  }

  reactionEntries(reactions?: { [k: string]: string[] }): { emoji: string; users: string[]; count: number }[] {
    if (!reactions) return [];
    return Object.entries(reactions)
      .filter(([, users]) => users.length > 0)
      .map(([emoji, users]) => ({ emoji, users, count: users.length }));
  }

  hasMyReaction(reactions?: { [k: string]: string[] }, emoji?: string): boolean {
    if (!reactions || !emoji || !this.currentUser) return false;
    return reactions[emoji]?.includes(this.currentUser.uid) || false;
  }

  getReplyMsg(replyId?: string): Message | undefined {
    return replyId ? this.messages.find((m) => m.id === replyId) : undefined;
  }

  // AI features
  async loadSmartReplies(): Promise<void> {
    this.showAiPanel = true;
    this.showGroupInfo = false;
    if (this.messages.length === 0) return;
    this.aiLoading = true;
    this.cdr.markForCheck();
    this.smartReplies = await this.aiService.getSmartReplies(this.messages.slice(-10));
    this.aiLoading = false;
    this.cdr.markForCheck();
  }

  async summarize(): Promise<void> {
    if (this.messages.length === 0) return;
    this.aiLoading = true;
    this.cdr.markForCheck();
    this.chatSummary = await this.aiService.summarizeChat(this.messages);
    this.aiLoading = false;
    this.cdr.markForCheck();
  }

  async askAi(): Promise<void> {
    if (!this.aiQuestion.trim()) return;
    this.aiLoading = true;
    this.cdr.markForCheck();
    this.aiAnswer = await this.aiService.askAboutChat(this.messages, this.aiQuestion);
    this.aiLoading = false;
    this.cdr.markForCheck();
  }

  useSuggestion(text: string): void {
    this.prefillText = text;
    this.showAiPanel = false;
  }

  toggleGroupInfo(): void {
    this.showGroupInfo = !this.showGroupInfo;
    this.showAiPanel = false;
  }

  toggleAiPanel(): void {
    this.showAiPanel = !this.showAiPanel;
    this.showGroupInfo = false;
    if (this.showAiPanel) this.loadSmartReplies();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
