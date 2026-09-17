import { Module } from '@nestjs/common';
import { AdminService } from './services/admin.service';
import { AdminController } from './http/admin.controller';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
