export type MemberRole = 'admin' | 'member';

export interface GroupMember {
  uid: string;
  name: string;
  photoURL: string;
  role: MemberRole;
  joinedAt: Date | any;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  photoURL: string;
  adminIds: string[];
  members: GroupMember[];
  memberIds: string[];
  createdBy: string;
  createdAt: Date | any;
  lastMessage?: string;
  lastMessageTime?: Date | any;
  lastMessageSender?: string;
  announcements?: string[];
  isPinned?: boolean;
}
