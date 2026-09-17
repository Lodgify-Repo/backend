import { LOG_DIR } from '@/common/constants';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import winston, { type Logger as WinLogger } from 'winston';

type LogFiles = 'server' | 'http' | 'access' | 'db' | 'mail' | 'payment';

class Logger {
  private static instances: Map<LogFiles, WinLogger> = new Map();
  private static logDir: string | null = null;

  private static initLogDir(): string {
    if (this.logDir) return this.logDir;

    const dir = join(process.cwd(), LOG_DIR);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.logDir = dir;
    return dir;
  }

  private static createLogger(filename: LogFiles): WinLogger {
    const logDir = this.initLogDir();

    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return stack ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}` : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: join(logDir, `${filename}.log`),
        }),
      ],
    });

    return logger;
  }

  public static getInstance(filename: LogFiles): WinLogger {
    if (!this.instances.has(filename)) {
      const logger = this.createLogger(filename);
      this.instances.set(filename, logger);
    }
    return this.instances.get(filename)!;
  }

  /** Returns the resolved absolute path to the log directory */
  public static getLogDir(): string {
    return this.initLogDir();
  }

  /** Returns all valid log channel names */
  public static getAvailableLogFiles(): LogFiles[] {
    return ['server', 'http', 'access', 'db', 'mail', 'payment'];
  }

  /**
   * Resolves a safe absolute path for a given log filename.
   * Returns null if the filename is not a recognized log channel (prevents path traversal).
   */
  public static getLogFilePath(filename: string): string | null {
    const allowed = this.getAvailableLogFiles() as string[];
    if (!allowed.includes(filename)) return null;
    return join(this.initLogDir(), `${filename}.log`);
  }
}

export default Logger;
