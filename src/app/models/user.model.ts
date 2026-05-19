export interface User {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date | any;
  bio?: string;
  phone?: string;
  pinnedChats?: string[];
  mutedChats?: string[];
  createdAt: Date | any;
}

export interface UserSearchResult {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  status: 'online' | 'offline' | 'away';
}
