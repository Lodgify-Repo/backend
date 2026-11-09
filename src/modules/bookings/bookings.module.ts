import { Module } from '@nestjs/common';
import { BookingsController } from './http/bookings.controller';
import { BookingsService } from './services/bookings.service';

@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
