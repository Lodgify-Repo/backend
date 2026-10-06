import { EventEmitter } from 'events';
import { Injectable } from '@nestjs/common';

type EventHandler = (...args: unknown[]) => void;

@Injectable()
export class EventBusService {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  emit<T = unknown>(event: string, ...args: T[]): void {
    this.emitter.emit(event, ...args);
  }

  on(event: string, handler: EventHandler): void {
    this.emitter.on(event, handler);
  }

  once(event: string, handler: EventHandler): void {
    this.emitter.once(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.emitter.off(event, handler);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  listenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }
}

export const eventBus = new EventBusService();
export default EventBusService;