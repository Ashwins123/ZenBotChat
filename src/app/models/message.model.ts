export type MessageStatus = 'sent' | 'delivered' | 'seen';
export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'voice' | 'system';

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  message: string;
  type: MessageType;
  timestamp: Date | any;
  status: MessageStatus;
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  thumbnailURL?: string;
  isEdited?: boolean;
  editedAt?: Date | any;
  isDeleted?: boolean;
  deletedAt?: Date | any;
  replyTo?: string;
  reactions?: { [emoji: string]: string[] };
  audioDuration?: number;
  senderName?: string;
  senderPhoto?: string;
}

export interface ChatPreview {
  chatId: string;
  userId?: string;
  groupId?: string;
  name: string;
  photoURL: string;
  lastMessage: string;
  lastMessageTime: Date | any;
  unreadCount: number;
  status?: 'online' | 'offline' | 'away';
  isPinned: boolean;
  isMuted: boolean;
  isGroup: boolean;
  isTyping?: boolean;
  memberCount?: number;
}
