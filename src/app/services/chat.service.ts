import { Injectable, inject } from '@angular/core';
import {
  Firestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, getDocs, getDoc,
  serverTimestamp, Timestamp, arrayUnion, arrayRemove, limit, startAfter,
  collectionGroup, writeBatch
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Message, ChatPreview } from '../models/message.model';
import { User } from '../models/user.model';
import { Group, GroupMember } from '../models/group.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private authService = inject(AuthService);

  private chatPreviewsSubject = new BehaviorSubject<ChatPreview[]>([]);
  chatPreviews$ = this.chatPreviewsSubject.asObservable();

  private messagesSubject = new BehaviorSubject<Message[]>([]);
  messages$ = this.messagesSubject.asObservable();

  private typingSubject = new BehaviorSubject<{ [chatId: string]: boolean }>({});
  typing$ = this.typingSubject.asObservable();

  private unsubscribeMessages: (() => void) | null = null;
  private unsubscribeChats: (() => void) | null = null;
  private previewsMap = new Map<string, ChatPreview>();

  getChatId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
  }

  private sortAndEmit(): void {
    const list = Array.from(this.previewsMap.values()).sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const timeA = a.lastMessageTime?.toDate?.()?.getTime() || 0;
      const timeB = b.lastMessageTime?.toDate?.()?.getTime() || 0;
      return timeB - timeA;
    });
    this.chatPreviewsSubject.next(list);
  }

  listenToChatPreviews(currentUserId: string): void {
    this.unsubscribeChats?.();
    this.previewsMap.clear();

    const currentUser = this.authService.currentUser!;

    // Listener 1: 1-to-1 chats
    const chatsQ = query(
      collection(this.firestore, 'chats'),
      where('members', 'array-contains', currentUserId)
    );
    const unsubChats = onSnapshot(chatsQ, async (snap) => {
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const otherUid = data['members'].find((m: string) => m !== currentUserId);
        if (!otherUid) continue;
        const otherUser = await this.authService.getUserProfile(otherUid);
        if (!otherUser) continue;
        this.previewsMap.set(docSnap.id, {
          chatId: docSnap.id, userId: otherUid,
          name: otherUser.name, photoURL: otherUser.photoURL,
          lastMessage: data['lastMessage'] || '',
          lastMessageTime: data['lastMessageTime'],
          unreadCount: data['unreadCounts']?.[currentUserId] || 0,
          status: otherUser.status,
          isPinned: currentUser.pinnedChats?.includes(docSnap.id) || false,
          isMuted: currentUser.mutedChats?.includes(docSnap.id) || false,
          isGroup: false
        });
      }
      // Remove deleted chats
      for (const [id] of this.previewsMap) {
        if (!snap.docs.find(d => d.id === id) && !this.previewsMap.get(id)?.isGroup) {
          this.previewsMap.delete(id);
        }
      }
      this.sortAndEmit();
    });

    // Listener 2: group chats (stored in separate 'groups' collection)
    const groupsQ = query(
      collection(this.firestore, 'groups'),
      where('memberIds', 'array-contains', currentUserId)
    );
    const unsubGroups = onSnapshot(groupsQ, (snap) => {
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        this.previewsMap.set(docSnap.id, {
          chatId: docSnap.id, groupId: docSnap.id,
          name: data['name'], photoURL: data['photoURL'] || '',
          lastMessage: data['lastMessage'] || '',
          lastMessageTime: data['lastMessageTime'],
          unreadCount: data['unreadCounts']?.[currentUserId] || 0,
          isPinned: currentUser.pinnedChats?.includes(docSnap.id) || false,
          isMuted: currentUser.mutedChats?.includes(docSnap.id) || false,
          isGroup: true, memberCount: data['memberIds']?.length || 0
        });
      }
      this.sortAndEmit();
    });

    this.unsubscribeChats = () => { unsubChats(); unsubGroups(); };
  }

  listenToMessages(chatId: string, isGroup = false): void {
    this.unsubscribeMessages?.();
    this.messagesSubject.next([]);

    const path = isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    const q = query(collection(this.firestore, path), orderBy('timestamp', 'asc'), limit(50));

    this.unsubscribeMessages = onSnapshot(q, (snap) => {
      const messages: Message[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      this.messagesSubject.next(messages);
    });
  }

  async sendMessage(chatId: string, message: Partial<Message>, isGroup = false): Promise<void> {
    const path = isGroup ? `groups/${chatId}/messages` : `chats/${chatId}/messages`;
    const msgRef = collection(this.firestore, path);
    const newMsg = { ...message, timestamp: serverTimestamp(), status: 'sent' };
    await addDoc(msgRef, newMsg);

    const chatRef = isGroup
      ? doc(this.firestore, 'groups', chatId)
      : doc(this.firestore, 'chats', chatId);

    await updateDoc(chatRef, {
      lastMessage: message.type === 'text' ? message.message : `📎 ${message.type}`,
      lastMessageTime: serverTimestamp(),
      lastMessageSender: message.senderId
    });
  }

  async createOrGetChat(currentUserId: string, otherUserId: string): Promise<string> {
    const chatId = this.getChatId(currentUserId, otherUserId);
    const chatRef = doc(this.firestore, 'chats', chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      await setDoc(chatRef, {
        members: [currentUserId, otherUserId],
        isGroup: false, createdAt: serverTimestamp(),
        lastMessage: '', lastMessageTime: serverTimestamp(),
        unreadCounts: { [currentUserId]: 0, [otherUserId]: 0 }
      });
    }
    return chatId;
  }

  async createGroup(name: string, memberIds: string[], description: string, currentUser: User): Promise<string> {
    const groupRef = collection(this.firestore, 'groups');
    const members: GroupMember[] = await Promise.all(memberIds.map(async (uid) => {
      const u = await this.authService.getUserProfile(uid);
      return { uid, name: u?.name || '', photoURL: u?.photoURL || '', role: 'member' as const, joinedAt: serverTimestamp() };
    }));

    members.push({ uid: currentUser.uid, name: currentUser.name, photoURL: currentUser.photoURL, role: 'admin' as const, joinedAt: serverTimestamp() });

    const allMemberIds = [...memberIds, currentUser.uid];
    const docRef = await addDoc(groupRef, {
      name, description, adminIds: [currentUser.uid],
      members, memberIds: allMemberIds,
      createdBy: currentUser.uid, createdAt: serverTimestamp(),
      photoURL: `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
      lastMessage: `${currentUser.name} created the group`,
      lastMessageTime: serverTimestamp(), isGroup: true,
      unreadCounts: Object.fromEntries(allMemberIds.map(id => [id, 0]))
    });

    await addDoc(collection(this.firestore, `groups/${docRef.id}/messages`), {
      senderId: 'system', message: `${currentUser.name} created the group "${name}"`,
      type: 'system', timestamp: serverTimestamp(), status: 'seen'
    });

    return docRef.id;
  }

  async markMessagesAsSeen(chatId: string, currentUserId: string, isGroup = false): Promise<void> {
    const chatRef = isGroup
      ? doc(this.firestore, 'groups', chatId)
      : doc(this.firestore, 'chats', chatId);
    await updateDoc(chatRef, { [`unreadCounts.${currentUserId}`]: 0 }).catch(() => {});
  }

  async deleteMessage(chatId: string, messageId: string, isGroup = false): Promise<void> {
    const path = isGroup
      ? `groups/${chatId}/messages/${messageId}`
      : `chats/${chatId}/messages/${messageId}`;
    await updateDoc(doc(this.firestore, path), {
      isDeleted: true, message: 'This message was deleted', deletedAt: serverTimestamp()
    });
  }

  async editMessage(chatId: string, messageId: string, newText: string, isGroup = false): Promise<void> {
    const path = isGroup
      ? `groups/${chatId}/messages/${messageId}`
      : `chats/${chatId}/messages/${messageId}`;
    await updateDoc(doc(this.firestore, path), {
      message: newText, isEdited: true, editedAt: serverTimestamp()
    });
  }

  async addReaction(chatId: string, messageId: string, emoji: string, userId: string, isGroup = false): Promise<void> {
    const path = isGroup
      ? `groups/${chatId}/messages/${messageId}`
      : `chats/${chatId}/messages/${messageId}`;
    await updateDoc(doc(this.firestore, path), {
      [`reactions.${emoji}`]: arrayUnion(userId)
    });
  }

  async uploadFile(chatId: string, file: File, senderId: string): Promise<{ url: string; type: string }> {
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, `chats/${chatId}/${fileName}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, type: file.type };
  }

  async setTyping(chatId: string, userId: string, isTyping: boolean, isGroup = false): Promise<void> {
    const path = isGroup ? `groups/${chatId}` : `chats/${chatId}`;
    await updateDoc(doc(this.firestore, path), {
      [`typing.${userId}`]: isTyping
    }).catch(() => {});
  }

  listenToTyping(chatId: string, isGroup = false): Observable<boolean> {
    return new Observable(observer => {
      const path = isGroup ? `groups/${chatId}` : `chats/${chatId}`;
      const unsub = onSnapshot(doc(this.firestore, path), (snap) => {
        const typing = snap.data()?.['typing'] || {};
        const currentUid = this.authService.currentUser?.uid;
        const someoneTyping = Object.entries(typing).some(
          ([uid, val]) => uid !== currentUid && val === true
        );
        observer.next(someoneTyping);
      });
      return () => unsub();
    });
  }

  async searchUsers(searchTerm: string, currentUserId: string): Promise<User[]> {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return [];
    const q = query(collection(this.firestore, 'users'), orderBy('name'), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as User)
      .filter(
        (u) =>
          u.uid !== currentUserId &&
          (u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term))
      );
  }

  async pinChat(userId: string, chatId: string, pin: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', userId), {
      pinnedChats: pin ? arrayUnion(chatId) : arrayRemove(chatId)
    });
  }

  async muteChat(userId: string, chatId: string, mute: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', userId), {
      mutedChats: mute ? arrayUnion(chatId) : arrayRemove(chatId)
    });
  }

  stopListening(): void {
    this.unsubscribeMessages?.();
    this.unsubscribeChats?.();
  }
}
