import {
  Controller,
  Get,
  Module,
} from '@nestjs/common';

import { ChatModule } from '../chat/chat.module.js';

@Controller('health')
class HealthController {
  @Get()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({
  imports: [ChatModule],
  controllers: [HealthController],
})
export class AppModule {}
