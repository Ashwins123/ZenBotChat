import { Injectable, inject } from '@angular/core';
import { Firestore, doc, updateDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private permission: NotificationPermission = 'default';

  async requestPermission(): Promise<void> {
    if ('Notification' in window) {
      this.permission = await Notification.requestPermission();
    }
  }

  show(title: string, body: string, icon?: string): void {
    if (this.permission === 'granted' && document.hidden) {
      const n = new Notification(title, {
        body, icon: icon || '/favicon.ico',
        badge: '/favicon.ico', tag: 'zenbot-msg'
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  }

  async saveFCMToken(userId: string, token: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', userId), { fcmToken: token });
  }

  playMessageSound(): void {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 520;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }
}
