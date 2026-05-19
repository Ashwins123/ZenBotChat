import { Component, inject, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { ChatPreview } from '../../models/message.model';
import { User } from '../../models/user.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ChatFilterPipe } from '../../shared/pipes/chat-filter.pipe';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, AvatarComponent, SkeletonComponent, ChatFilterPipe],
  templateUrl: './chat-list.component.html',
  styleUrls: ['./chat-list.component.scss'],
})
export class ChatListComponent implements OnInit, OnDestroy {
  @Output() chatSelected = new EventEmitter<ChatPreview>();

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  themeService = inject(ThemeService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  currentUser!: User;
  chatPreviews: ChatPreview[] = [];
  filteredPreviews: ChatPreview[] = [];
  loading = true;

  // ── Main sidebar search ──
  showSearch = false;
  searchControl = new FormControl('');
  searchResults: User[] = [];
  searchingUsers = false;
  searchError = '';

  // ── New chat modal ──
  showNewChatModal = false;
  newChatSearch = new FormControl('');
  newChatResults: User[] = [];
  newChatSearching = false;

  // ── Group modal ──
  showGroupModal = false;
  groupName = '';
  groupDesc = '';
  groupSearch = new FormControl('');    // separate control — no conflict
  groupSearchResults: User[] = [];
  groupSearching = false;
  groupSearchError = '';
  groupCreating = false;
  groupError = '';
  selectedMembers: User[] = [];

  activeTab: 'chats' | 'groups' = 'chats';

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser!;
    this.chatService.listenToChatPreviews(this.currentUser.uid);

    this.chatService.chatPreviews$.pipe(takeUntil(this.destroy$)).subscribe((previews) => {
      this.chatPreviews = previews;
      this.filterByTab();
      this.loading = false;
    });

    // Main sidebar search
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (term) => {
        if (term && term.length >= 2) {
          this.searchingUsers = true;
          this.searchError = '';
          try {
            this.searchResults = await this.chatService.searchUsers(term, this.currentUser.uid);
            this.filteredPreviews = this.chatPreviews.filter((c) =>
              c.name.toLowerCase().includes(term.toLowerCase())
            );
          } catch {
            this.searchError = 'Search failed. Check your connection.';
          } finally {
            this.searchingUsers = false;
          }
        } else {
          this.searchResults = [];
          this.searchError = '';
          this.filterByTab();
        }
      });

    // New chat modal search
    this.newChatSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (term) => {
        if (term && term.length >= 2) {
          this.newChatSearching = true;
          try {
            this.newChatResults = await this.chatService.searchUsers(term, this.currentUser.uid);
          } catch {
            this.newChatResults = [];
          } finally {
            this.newChatSearching = false;
          }
        } else {
          this.newChatResults = [];
        }
      });

    // Group modal member search — completely separate control
    this.groupSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(async (term) => {
        if (term && term.length >= 2) {
          this.groupSearching = true;
          this.groupSearchError = '';
          try {
            this.groupSearchResults = await this.chatService.searchUsers(term, this.currentUser.uid);
            if (this.groupSearchResults.length === 0) {
              this.groupSearchError = `No users found for "${term}". Make sure they are registered.`;
            }
          } catch {
            this.groupSearchError = 'Search failed. Check Firestore is enabled in Firebase Console.';
            this.groupSearchResults = [];
          } finally {
            this.groupSearching = false;
          }
        } else {
          this.groupSearchResults = [];
          this.groupSearchError = '';
        }
      });
  }

  filterByTab(): void {
    this.filteredPreviews = this.chatPreviews.filter((c) =>
      this.activeTab === 'groups' ? c.isGroup : !c.isGroup
    );
  }

  setTab(tab: 'chats' | 'groups'): void {
    this.activeTab = tab;
    this.filterByTab();
  }

  openChat(preview: ChatPreview): void {
    this.chatSelected.emit(preview);
  }

  async startChatWith(user: User): Promise<void> {
    const chatId = await this.chatService.createOrGetChat(this.currentUser.uid, user.uid);
    const preview: ChatPreview = {
      chatId, userId: user.uid, name: user.name, photoURL: user.photoURL,
      lastMessage: '', lastMessageTime: null, unreadCount: 0,
      status: user.status, isPinned: false, isMuted: false, isGroup: false,
    };
    this.chatSelected.emit(preview);
    this.closeNewChatModal();
  }

  closeNewChatModal(): void {
    this.showNewChatModal = false;
    this.newChatSearch.setValue('');
    this.newChatResults = [];
  }

  openGroupModal(): void {
    this.showGroupModal = true;
    this.groupName = '';
    this.groupDesc = '';
    this.groupSearch.setValue('');
    this.groupSearchResults = [];
    this.selectedMembers = [];
    this.groupError = '';
    this.groupSearchError = '';
  }

  closeGroupModal(): void {
    this.showGroupModal = false;
  }

  async createGroup(): Promise<void> {
    if (!this.groupName.trim()) { this.groupError = 'Group name is required.'; return; }
    if (this.selectedMembers.length === 0) { this.groupError = 'Add at least 1 member.'; return; }
    this.groupCreating = true;
    this.groupError = '';
    try {
      const memberIds = this.selectedMembers.map((m) => m.uid);
      await this.chatService.createGroup(this.groupName.trim(), memberIds, this.groupDesc.trim(), this.currentUser);
      this.closeGroupModal();
      this.setTab('groups');
    } catch (e: any) {
      this.groupError = 'Failed to create group. Make sure Firestore is enabled.';
    } finally {
      this.groupCreating = false;
    }
  }

  toggleMember(user: User): void {
    const idx = this.selectedMembers.findIndex((m) => m.uid === user.uid);
    if (idx >= 0) this.selectedMembers.splice(idx, 1);
    else this.selectedMembers.push(user);
  }

  isMemberSelected(uid: string): boolean {
    return this.selectedMembers.some((m) => m.uid === uid);
  }

  async pinChat(chatId: string, pinned: boolean, e: Event): Promise<void> {
    e.stopPropagation();
    await this.chatService.pinChat(this.currentUser.uid, chatId, !pinned);
  }

  async muteChat(chatId: string, muted: boolean, e: Event): Promise<void> {
    e.stopPropagation();
    await this.chatService.muteChat(this.currentUser.uid, chatId, !muted);
  }

  formatTime(ts: any): string {
    if (!ts) return '';
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
