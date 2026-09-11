import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller.js';
import { ragProviders } from './rag.providers.js';
import { ChatService } from './chat.service.js';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ...ragProviders],
})
export class ChatModule {}
