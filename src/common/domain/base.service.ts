import Logger from '@/infra/logger/logger.service';

export class Service {
  private readonly _logger = Logger.getInstance('server');

  protected readonly logger = {
    info: (message: string, ...args: any[]) => this._logger.info(`[${this.constructor.name}]: ${message}`, ...args),
    error: (message: string, ...args: any[]) => this._logger.error(`[${this.constructor.name}]: ${message}`, ...args),
    warn: (message: string, ...args: any[]) => this._logger.warn(`[${this.constructor.name}]: ${message}`, ...args),
  };

  protected readonly commonQueries = {};
}
