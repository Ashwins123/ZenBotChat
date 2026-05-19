import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { environment } from '../../environments/environment';
import { Message } from '../models/message.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

  constructor(private http: HttpClient) {}

  async getSmartReplies(messages: Message[]): Promise<string[]> {
    const lastFew = messages.slice(-5).map(m => m.message).join('\n');
    const prompt = `Based on this chat: "${lastFew}" — suggest 3 short smart replies. Return only a JSON array of strings.`;

    try {
      const res: any = await this.http.post(
        `${this.GEMINI_URL}?key=${environment.geminiApiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      ).toPromise();
      const text = res?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
      return ['👍', '😊 Thanks!', 'Sure!'];
    }
  }

  async summarizeChat(messages: Message[]): Promise<string> {
    const convo = messages.map(m => `${m.senderName || m.senderId}: ${m.message}`).join('\n');
    const prompt = `Summarize this conversation briefly in 2-3 sentences:\n${convo}`;

    try {
      const res: any = await this.http.post(
        `${this.GEMINI_URL}?key=${environment.geminiApiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      ).toPromise();
      return res?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to summarize.';
    } catch {
      return 'Unable to summarize chat at this time.';
    }
  }

  async askAboutChat(messages: Message[], question: string): Promise<string> {
    const convo = messages.map(m => `${m.senderName || m.senderId}: ${m.message}`).join('\n');
    const prompt = `Based on this conversation:\n${convo}\n\nAnswer: ${question}`;

    try {
      const res: any = await this.http.post(
        `${this.GEMINI_URL}?key=${environment.geminiApiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      ).toPromise();
      return res?.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not find an answer.';
    } catch {
      return 'AI assistant is unavailable right now.';
    }
  }
}
