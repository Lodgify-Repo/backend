import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infra/database/database.module';
import { EventBusModule } from './infra/eventbus.module';
import { MailModule } from './infra/mail/mail.module';
import { AuthEventListeners } from './common/events/auth.events';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { envValidationSchema } from './common/config/env.validation';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    EventBusModule,
    MailModule,
    AuthModule,
    UsersModule,
    AdminModule,
    PropertiesModule,
  ],
  controllers: [AppController],
  providers: [AppService, AuthEventListeners],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: 'api/*', method: RequestMethod.ALL });
  }
}
