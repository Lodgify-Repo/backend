import { Global, Module } from '@nestjs/common';
import { EventBusService, eventBus } from './eventbus';

@Global()
@Module({
  providers: [{ provide: EventBusService, useValue: eventBus }],
  exports: [EventBusService],
})
export class EventBusModule {}
