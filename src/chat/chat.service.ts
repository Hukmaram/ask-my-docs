import {
  Inject,
  Injectable,
} from '@nestjs/common';

import {
  AskMyDocsAgent,
  type AskMyDocsResponse,
} from '../agent/ask-my-docs.agent.js';
import { ASK_MY_DOCS_AGENT } from './rag.providers.js';

@Injectable()
export class ChatService {
  constructor(
    @Inject(ASK_MY_DOCS_AGENT)
    private readonly agent: AskMyDocsAgent,
  ) {}

  ask(query: string): Promise<AskMyDocsResponse> {
    return this.agent.ask(query);
  }
}
