import { Pipe, PipeTransform } from '@angular/core';
import { ChatPreview } from '../../models/message.model';

@Pipe({ name: 'chatFilter', standalone: true, pure: false })
export class ChatFilterPipe implements PipeTransform {
  transform(chats: ChatPreview[], isGroup: boolean): ChatPreview[] {
    return chats.filter((c) => c.isGroup === isGroup);
  }
}
