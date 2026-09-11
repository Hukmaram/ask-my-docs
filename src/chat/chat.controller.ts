import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import type { AskMyDocsResponse } from '../agent/ask-my-docs.agent.js';
import { ChatRequestDto } from './dto/chat-request.dto.js';
import { ChatService } from './chat.service.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
  ) {}

  @Post()
  ask(
    @Body() request: ChatRequestDto,
  ): Promise<AskMyDocsResponse> {
    return this.chatService.ask(request.query);
  }
}
