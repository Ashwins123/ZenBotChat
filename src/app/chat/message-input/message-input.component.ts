import { Component, inject, Input, Output, EventEmitter, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './message-input.component.html',
  styleUrls: ['./message-input.component.scss']
})
export class MessageInputComponent implements OnDestroy {
  @Input() chatId!: string;
  @Input() isGroup = false;
  @Input() replyMessage: Message | null = null;
  @Input() set prefillText(val: string) {
    if (val) { this.messageText = val; this.messageTextarea?.nativeElement?.focus(); }
  }
  @Output() messageSent = new EventEmitter<void>();
  @Output() cancelReply = new EventEmitter<void>();
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('messageTextarea') messageTextarea!: ElementRef;

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private destroy$ = new Subject<void>();
  private typingTimeout: any;
  private typingSubject = new Subject<void>();

  messageText = '';
  sending = false;
  showEmojiPicker = false;
  sendError = '';
  previewFile: { url: string; type: string; name: string; file: File } | null = null;

  readonly emojis = ['😀','😂','😍','🥰','😊','😎','🤔','😅','😭','😡','🎉','👍','👎','❤️','🔥','✨','💯','🙏','👏','😴'];

  constructor() {
    this.typingSubject.pipe(debounceTime(2000), takeUntil(this.destroy$)).subscribe(() => {
      const uid = this.authService.currentUser?.uid;
      if (this.chatId && uid) this.chatService.setTyping(this.chatId, uid, false, this.isGroup);
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInput(): void {
    const uid = this.authService.currentUser?.uid;
    if (this.chatId && uid) {
      this.chatService.setTyping(this.chatId, uid, true, this.isGroup);
      this.typingSubject.next();
    }
  }

  async sendMessage(): Promise<void> {
    const text = this.messageText.trim();
    if ((!text && !this.previewFile) || this.sending) return;

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      this.sendError = 'Not signed in. Please refresh the page.';
      return;
    }

    this.sending = true;
    this.sendError = '';
    this.chatService.setTyping(this.chatId, currentUser.uid, false, this.isGroup).catch(() => {});

    try {
      if (this.previewFile) {
        const { url, type } = await this.chatService.uploadFile(this.chatId, this.previewFile.file, currentUser.uid);
        const msgType = type.startsWith('image/') ? 'image' : 'file';
        await this.chatService.sendMessage(this.chatId, {
          senderId: currentUser.uid,
          senderName: currentUser.name,
          senderPhoto: currentUser.photoURL,
          message: text || this.previewFile.name,
          type: msgType,
          fileURL: url,
          fileName: this.previewFile.name,
          ...(this.replyMessage?.id ? { replyTo: this.replyMessage.id } : {})
        }, this.isGroup);
        this.previewFile = null;
      }

      if (text) {
        await this.chatService.sendMessage(this.chatId, {
          senderId: currentUser.uid,
          senderName: currentUser.name,
          senderPhoto: currentUser.photoURL,
          message: text,
          type: 'text',
          ...(this.replyMessage?.id ? { replyTo: this.replyMessage.id } : {})
        }, this.isGroup);
      }

      this.messageText = '';
      this.cancelReply.emit();
      this.messageSent.emit();
    } catch (e: any) {
      this.sendError = e?.code === 'permission-denied'
        ? 'Permission denied. Check Firestore rules in Firebase Console.'
        : `Failed to send: ${e?.message || 'Unknown error'}`;
    } finally {
      this.sending = false;
    }
  }

  insertEmoji(emoji: string): void {
    this.messageText += emoji;
    this.showEmojiPicker = false;
    this.messageTextarea?.nativeElement?.focus();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('File size must be under 10MB'); return; }
    const url = URL.createObjectURL(file);
    this.previewFile = { url, type: file.type, name: file.name, file };
  }

  clearPreview(): void {
    if (this.previewFile) URL.revokeObjectURL(this.previewFile.url);
    this.previewFile = null;
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.previewFile) URL.revokeObjectURL(this.previewFile.url);
  }
}
