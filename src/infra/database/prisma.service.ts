import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Logger from '@/infra/logger/logger.service';

const softDeletableModels = ['User'];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = Logger.getInstance('db');

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    this.$use(async (params, next) => {
      if (!softDeletableModels.includes(params.model as string)) {
        return next(params);
      }

      params.args = params.args ?? {};

      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst';
        params.args.where = { ...params.args.where, deletedAt: null };
      }

      if (params.action === 'findMany' || params.action === 'count') {
        params.args.where = { deletedAt: null, ...params.args.where };
      }

      return next(params);
    });

    this.$on('info' as never, (e: any) => {
      this.logger.info(e.message);
    });
    this.$on('warn' as never, (e: any) => {
      this.logger.warn(e.message);
    });
    this.$on('error' as never, (e: any) => {
      this.logger.error(e.message);
    });

    await this.$connect();
    this.logger.info('Successfully connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.info('Successfully disconnected from database');
  }
}
