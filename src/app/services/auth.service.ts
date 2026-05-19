import { Injectable, inject } from '@angular/core';
import {
  Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, User as FirebaseUser,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail
} from '@angular/fire/auth';
import {
  Firestore, doc, setDoc, getDoc, updateDoc, serverTimestamp
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { User } from '../models/user.model';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private router = inject(Router);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private initializedSubject = new BehaviorSubject<boolean>(false);
  initialized$ = this.initializedSubject.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await this.getUserProfile(firebaseUser.uid);
        this.currentUserSubject.next(user);
        await this.updateOnlineStatus(firebaseUser.uid, 'online');
      } else {
        this.currentUserSubject.next(null);
      }
      this.initializedSubject.next(true);
    });

    window.addEventListener('beforeunload', () => {
      const user = this.currentUserSubject.value;
      if (user) this.updateOnlineStatus(user.uid, 'offline');
    });
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const user: User = {
      uid: cred.user.uid, name, email,
      photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      status: 'online', lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(), pinnedChats: [], mutedChats: []
    };
    await setDoc(doc(this.firestore, 'users', cred.user.uid), user);
    this.currentUserSubject.next(user);
  }

  async login(email: string, password: string): Promise<void> {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    // onAuthStateChanged will handle profile fetch and currentUserSubject update
    await this.updateOnlineStatus(cred.user.uid, 'online').catch(() => {});
  }

  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    const existing = await this.getUserProfile(cred.user.uid);
    if (!existing) {
      const user: User = {
        uid: cred.user.uid,
        name: cred.user.displayName || 'User',
        email: cred.user.email || '',
        photoURL: cred.user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${cred.user.uid}`,
        status: 'online', lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(), pinnedChats: [], mutedChats: []
      };
      await setDoc(doc(this.firestore, 'users', cred.user.uid), user);
      this.currentUserSubject.next(user);
    } else {
      await this.updateOnlineStatus(cred.user.uid, 'online');
      this.currentUserSubject.next(existing);
    }
  }

  async logout(): Promise<void> {
    const uid = this.currentUserSubject.value?.uid;
    if (uid) await this.updateOnlineStatus(uid, 'offline');
    await signOut(this.auth);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async getUserProfile(uid: string): Promise<User | null> {
    const snap = await getDoc(doc(this.firestore, 'users', uid));
    return snap.exists() ? (snap.data() as User) : null;
  }

  async updateProfile(uid: string, data: Partial<User>): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { ...data });
    const updated = { ...this.currentUserSubject.value, ...data } as User;
    this.currentUserSubject.next(updated);
  }

  async uploadAvatar(uid: string, file: File): Promise<string> {
    const storageRef = ref(this.storage, `avatars/${uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await this.updateProfile(uid, { photoURL: url });
    return url;
  }

  private async updateOnlineStatus(uid: string, status: 'online' | 'offline'): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), {
      status, lastSeen: serverTimestamp()
    }).catch(() => {});
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }
}
